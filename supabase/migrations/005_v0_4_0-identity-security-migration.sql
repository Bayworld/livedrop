-- DropLive v0.4.0 identity + security migration
-- ADDITIVE and re-runnable. Does not delete or rewrite Drops, requests, contributions, profiles or auth users.
-- Run once in the Supabase SQL Editor. Do NOT run supabase-schema.sql or older migrations again.
-- Replaces the old name-matching request policies (anyone could rename themselves to read another creator's requests).

-- 1. Public-safe creator names (id, name, avatar only) for Drop owners, so public pages never fall back to "Creator".
do $$ begin
  if not exists (select 1 from pg_views where schemaname='public' and viewname='public_creator_profiles') then
    execute 'create view public.public_creator_profiles as
      select p.id, p.display_name, p.avatar_url, p.role from public.profiles p
      where p.role in (''creator'',''both'') or exists (select 1 from public.drops d where d.creator_id = p.id)';
  end if;
end $$;  -- if the v0.5.0 version of this view already exists, it is left as is
grant select on public.public_creator_profiles to anon, authenticated;

-- 2. Requests: access by stable account ID only (no display-name matching).
drop policy if exists "drop_requests_creator_read" on public.drop_requests;
create policy "drop_requests_creator_read" on public.drop_requests for select
  using (auth.uid() = fan_id or auth.uid() = creator_id);

drop policy if exists "drop_requests_creator_update" on public.drop_requests;
create policy "drop_requests_creator_update" on public.drop_requests for update
  using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "drop_requests_own_insert" on public.drop_requests;
create policy "drop_requests_own_insert" on public.drop_requests for insert
  with check (
    auth.uid() = fan_id and status = 'open'
    and (creator_id is null or exists (select 1 from public.profiles p where p.id = creator_id and p.role in ('creator','both')))
  );

create or replace function public.drop_requests_guard_client_writes() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;  -- SQL editor / server-side only
  if tg_op = 'UPDATE' then  -- a creator may change status only
    new.fan_id := old.fan_id; new.creator_id := old.creator_id; new.creator_name := old.creator_name;
    new.title := old.title; new.description := old.description; new.willing_amount := old.willing_amount;
    new.potential_supporters := old.potential_supporters; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists drop_requests_guard on public.drop_requests;
create trigger drop_requests_guard before update on public.drop_requests
  for each row execute function public.drop_requests_guard_client_writes();

-- 3. Drops: only creator/both accounts may create; money fields and owner cannot be set from the browser.
drop policy if exists "drops_creator_insert" on public.drops;
create policy "drops_creator_insert" on public.drops for insert
  with check (auth.uid() = creator_id and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('creator','both')));

drop policy if exists "drops_creator_update" on public.drops;
create policy "drops_creator_update" on public.drops for update
  using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

create or replace function public.drops_guard_client_writes() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;  -- SQL editor / server-side (future verified payments)
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
  end if;
  return new;
end $$;
drop trigger if exists drops_guard on public.drops;
create trigger drops_guard before insert or update on public.drops
  for each row execute function public.drops_guard_client_writes();

-- 4. Contributions: browser may only create a PENDING pledge on an open Drop it does not own. It can never mark itself paid.
drop policy if exists "contributions_own_insert" on public.contributions;
create policy "contributions_own_insert" on public.contributions for insert
  with check (
    auth.uid() = fan_id and status = 'pending' and paid_at is null
    and provider_reference is null and payment_provider is null
    and exists (select 1 from public.drops d
                where d.id = drop_id and d.status in ('funding','unlocked','live')
                  and d.creator_id <> auth.uid() and amount >= d.contribution_amount)
  );

-- Verify afterwards (read-only):
--   select tablename, policyname, cmd from pg_policies where schemaname='public' order by 1,2;
--   select tgname, tgrelid::regclass from pg_trigger where tgname in ('drops_guard','drop_requests_guard');
-- Rollback: re-create the previous policies from the older SQL files and drop the two triggers/functions/view above.
