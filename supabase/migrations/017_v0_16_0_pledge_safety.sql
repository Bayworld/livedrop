-- DropLive v0.16.0. Re-runnable. Run after 016.
-- 1) Fans can withdraw a pending pledge.  2) Stale pending pledges are closed automatically.
-- 3) While payments are off, creators can record a manual refund, and a Drop that still has paid
--    supporters can no longer be cancelled from the browser (refund them first).

-- Allow a 'cancelled' pledge status.
do $$
declare cname text;
begin
  select conname into cname from pg_constraint
   where conrelid = 'public.contributions'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%pending%paid%';
  if cname is not null then execute format('alter table public.contributions drop constraint %I', cname); end if;
  alter table public.contributions add constraint contributions_status_chk
    check (status in ('pending','paid','failed','refunded','cancelled'));
exception when duplicate_object then null;
end $$;

create or replace function public.fan_cancel_pledge(p_contribution_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c public.contributions;
begin
  select * into c from public.contributions where id = p_contribution_id for update;
  if not found or c.fan_id is distinct from auth.uid() then raise exception 'Pledge not found.'; end if;
  if c.status = 'cancelled' then return 'already'; end if;
  if c.status <> 'pending' then raise exception 'Only a pending pledge can be withdrawn. Ask the creator about a refund.'; end if;
  update public.contributions set status = 'cancelled' where id = c.id;
  return 'cancelled';
end $$;
revoke all on function public.fan_cancel_pledge(uuid) from public, anon;
grant execute on function public.fan_cancel_pledge(uuid) to authenticated;

create or replace function public.expire_stale_pledges() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.contributions c set status = 'cancelled'
  from public.drops d
  where c.drop_id = d.id and c.status = 'pending'
    and ((d.deadline is not null and d.deadline < now()) or d.status in ('cancelled','failed','completed'));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.expire_stale_pledges() from public, anon, authenticated;

create or replace function public.creator_mark_pledge_refunded(p_contribution_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c public.contributions; d public.drops; pay boolean; other_paid boolean;
begin
  select coalesce((select value = 'true' from public.app_settings where key = 'payments_enabled'), false) into pay;
  if pay then raise exception 'Manual refunds are only available while payments are off.'; end if;
  select * into c from public.contributions where id = p_contribution_id for update;
  if not found then raise exception 'Pledge not found.'; end if;
  select * into d from public.drops where id = c.drop_id for update;
  if d.creator_id is distinct from auth.uid() then raise exception 'Pledge not found.'; end if;
  if c.status = 'refunded' then return 'already'; end if;
  if c.status <> 'paid' then raise exception 'Only a paid pledge can be refunded.'; end if;
  other_paid := exists (select 1 from public.contributions
    where drop_id = c.drop_id and fan_id = c.fan_id and status = 'paid' and id <> c.id);
  update public.contributions set status = 'refunded' where id = c.id;
  perform set_config('droplive.phase_change', '1', true);
  update public.drops set
    raised_amount = greatest(raised_amount - c.amount, 0),
    contributor_count = greatest(contributor_count - (case when other_paid then 0 else 1 end), 0),
    status = case when status = 'unlocked' and raised_amount - c.amount < goal_amount then 'funding' else status end
  where id = d.id;
  perform set_config('droplive.phase_change', '0', true);
  perform public.notify_users(array[c.fan_id], 'pledge_refunded', 'Your pledge was refunded',
    left('The creator recorded a refund for "' || coalesce(d.title, 'the session') || '".', 200), '?drop=' || d.id::text);
  return 'refunded';
end $$;
revoke all on function public.creator_mark_pledge_refunded(uuid) from public, anon;
grant execute on function public.creator_mark_pledge_refunded(uuid) to authenticated;

-- Browser guard: same as before, plus no cancelling a Drop that still holds paid pledges.
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
    if new.status = 'cancelled' and old.status <> 'cancelled'
       and exists (select 1 from public.contributions c where c.drop_id = old.id and c.status = 'paid') then
      raise exception 'Refund your paid supporters first (Mark refunded on the dashboard), then cancel the Drop.';
    end if;
    if (new.goal_amount is distinct from old.goal_amount or new.contribution_amount is distinct from old.contribution_amount)
       and exists (select 1 from public.contributions c where c.drop_id = old.id) then
      raise exception 'Goal and contribution amount cannot change after fans have pledged.';
    end if;
  end if;
  return new;
end $$;

-- Schedule the stale-pledge sweep (needs pg_cron; safe to re-run).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('droplive-expire-pledges', '*/15 * * * *', 'select public.expire_stale_pledges()');
  else
    raise notice 'pg_cron is not enabled. Enable it, then re-run this migration to create the schedule.';
  end if;
end $$;

notify pgrst, 'reload schema';
