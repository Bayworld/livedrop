-- DropLive v0.11.0 lifecycle + in-app notifications. ADDITIVE and re-runnable. Run once after 010.
-- (The payments migration is renumbered 012 and is only run when you enable payments.)
-- UNTESTED against a live database: run on a staging Supabase project first.

-- 1. Non-secret app settings. payments_enabled controls which Drop stage changes are allowed.
create table if not exists public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;
drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read" on public.app_settings for select using (true);
insert into public.app_settings(key, value) values ('payments_enabled', 'false') on conflict (key) do nothing;
-- At launch, after payments work:  update public.app_settings set value='true' where key='payments_enabled';

-- 2. Notifications (in-app now; email can read this same table later).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) <= 160),
  body text not null default '' check (char_length(body) <= 500),
  link text check (link is null or link ~ '^\?[A-Za-z0-9=&_.@%-]{1,200}$'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;   -- users can ONLY mark read

create or replace function public.notify_users(p_users uuid[], p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, kind, title, body, link)
  select distinct u, p_kind, p_title, p_body, p_link from unnest(p_users) as u where u is not null;
$$;
revoke all on function public.notify_users(uuid[], text, text, text, text) from public, anon, authenticated;

-- 3. Drops guard: same rules as before, plus a transaction-local bypass used only by set_drop_phase().
create or replace function public.drops_guard_client_writes() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if current_setting('droplive.phase_change', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.raised_amount := 0; new.contributor_count := 0;
    if new.status not in ('draft','funding') then new.status := 'funding'; end if;
  else
    if new.creator_id is distinct from old.creator_id then raise exception 'A Drop owner cannot be changed.'; end if;
    new.raised_amount := old.raised_amount; new.contributor_count := old.contributor_count;
    if new.status is distinct from old.status
       and not (new.status in ('draft','funding','cancelled') and old.status in ('draft','funding','cancelled')) then
      raise exception 'This status change is not allowed from the browser.';
    end if;
    if (new.goal_amount is distinct from old.goal_amount or new.contribution_amount is distinct from old.contribution_amount)
       and exists (select 1 from public.contributions c where c.drop_id = old.id) then
      raise exception 'Goal and contribution amount cannot change after fans have pledged.';
    end if;
  end if;
  return new;
end $$;

-- 4. The ONLY way a creator moves a Drop to live or completed.
create or replace function public.set_drop_phase(p_drop_id uuid, p_phase text) returns text
language plpgsql security definer set search_path = public as $$
declare d public.drops; pay boolean;
begin
  select * into d from public.drops where id = p_drop_id for update;
  if not found or d.creator_id is distinct from auth.uid() then raise exception 'Drop not found.'; end if;
  select coalesce((select value = 'true' from public.app_settings where key = 'payments_enabled'), false) into pay;
  if p_phase = 'live' then
    if not (d.status = 'unlocked' or (not pay and d.status = 'funding')) then
      raise exception 'A Drop can only go live once its goal is funded.';
    end if;
  elsif p_phase = 'completed' then
    if d.status <> 'live' then raise exception 'Only a live Drop can be ended.'; end if;
  else
    raise exception 'Unknown phase.';
  end if;
  perform set_config('droplive.phase_change', '1', true);
  update public.drops set status = p_phase where id = d.id;
  perform set_config('droplive.phase_change', '0', true);
  return p_phase;
end $$;
revoke all on function public.set_drop_phase(uuid, text) from public, anon;
grant execute on function public.set_drop_phase(uuid, text) to authenticated;

-- 5. Notification triggers.
create or replace function public.trg_request_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare cname text; audience uuid[];
begin
  if tg_op = 'INSERT' then
    if new.creator_id is not null then
      perform public.notify_users(array[new.creator_id], 'new_request', 'New fan request',
        left(new.title, 120), '?creator=' || new.creator_id::text);
    end if;
    return new;
  end if;
  if new.status is not distinct from old.status or new.status not in ('accepted','declined','converted') then return new; end if;
  select coalesce(display_name, 'The creator') into cname from public.profiles where id = new.creator_id;
  select array_agg(x) into audience from (
    select new.fan_id as x union select fan_id from public.request_pledges where request_id = new.id) t;
  perform public.notify_users(audience, 'request_' || new.status,
    case new.status when 'accepted' then cname || ' accepted your request'
                    when 'declined' then cname || ' passed on this request'
                    else cname || ' created a Drop for your request' end,
    left(new.title, 160), '?creator=' || new.creator_id::text);
  return new;
end $$;
drop trigger if exists request_notify on public.drop_requests;
create trigger request_notify after insert or update of status on public.drop_requests
  for each row execute function public.trg_request_notify();

create or replace function public.trg_drop_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare cname text; audience uuid[]; lnk text := '?drop=' || new.id::text;
begin
  select coalesce(display_name, 'A creator') into cname from public.profiles where id = new.creator_id;
  if tg_op = 'INSERT' then
    select array_agg(fan_id) into audience from public.creator_follows where creator_id = new.creator_id;
    perform public.notify_users(audience, 'new_drop', cname || ' posted a new Drop', left(new.title, 160), lnk);
    return new;
  end if;
  if new.status is not distinct from old.status or new.status not in ('unlocked','live','cancelled','completed') then return new; end if;
  select array_agg(x) into audience from (
    select fan_id as x from public.contributions where drop_id = new.id and status in ('pending','paid')
    union select fan_id from public.creator_follows where creator_id = new.creator_id and new.status = 'live') t;
  perform public.notify_users(audience, 'drop_' || new.status,
    case new.status when 'unlocked' then 'Funded! ' || left(new.title, 100) || ' is unlocked'
                    when 'live' then 'LIVE NOW: ' || left(new.title, 120)
                    when 'completed' then 'Thanks for joining ' || left(new.title, 110)
                    else 'Cancelled: ' || left(new.title, 120) end,
    cname, lnk);
  return new;
end $$;
drop trigger if exists drop_notify on public.drops;
create trigger drop_notify after insert or update of status on public.drops
  for each row execute function public.trg_drop_notify();

notify pgrst, 'reload schema';
