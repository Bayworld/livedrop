-- DropLive v0.10.0 payments (Paystack). ADDITIVE and re-runnable. Run ONLY when you enable payments (after 011).
-- UNTESTED against a live database: run on a staging Supabase project first.

-- 1. Browsers can no longer create contributions. Only the paystack-init Edge Function (service role) can,
--    so the amount always comes from the Drop row and cannot be tampered with.
drop policy if exists "contributions_own_insert" on public.contributions;

-- 2. Audit + idempotency log of every payment event. No policies = service role only.
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  reference text not null,
  kind text not null check (kind in ('paid','refunded','mismatch')),
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;

-- 3. Mark a contribution paid (idempotent, atomic). Called only by Edge Functions after Paystack verification.
create or replace function public.mark_contribution_paid(p_reference text, p_event_id text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.contributions; d public.drops; first_from_fan boolean;
begin
  insert into public.payment_events(event_id, reference, kind, payload)
    values (p_event_id, p_reference, 'paid', p_payload) on conflict (event_id) do nothing;
  select * into c from public.contributions where provider_reference = p_reference for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_reference'); end if;
  if c.status = 'paid' then return jsonb_build_object('ok', true, 'already', true); end if;
  if c.status = 'refunded' then return jsonb_build_object('ok', false, 'reason', 'refunded'); end if;
  select * into d from public.drops where id = c.drop_id for update;
  update public.contributions set status = 'paid', paid_at = now() where id = c.id;
  if d.status in ('cancelled', 'failed') then
    -- Money arrived after the Drop closed: keep the record, do not count it, flag for refund.
    return jsonb_build_object('ok', true, 'needs_refund', true, 'drop_id', d.id);
  end if;
  first_from_fan := not exists (select 1 from public.contributions
    where drop_id = c.drop_id and fan_id = c.fan_id and status = 'paid' and id <> c.id);
  update public.drops set
    raised_amount = raised_amount + c.amount,
    contributor_count = contributor_count + (case when first_from_fan then 1 else 0 end),
    status = case when status = 'funding' and raised_amount + c.amount >= goal_amount then 'unlocked' else status end
  where id = d.id;
  return jsonb_build_object('ok', true, 'drop_id', d.id);
end $$;

-- 4. Mark a contribution refunded and reverse the Drop totals.
create or replace function public.mark_contribution_refunded(p_reference text, p_event_id text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.contributions; d public.drops; last_from_fan boolean;
begin
  insert into public.payment_events(event_id, reference, kind, payload)
    values (p_event_id, p_reference, 'refunded', p_payload) on conflict (event_id) do nothing;
  select * into c from public.contributions where provider_reference = p_reference for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_reference'); end if;
  if c.status <> 'paid' then return jsonb_build_object('ok', true, 'already', true); end if;
  select * into d from public.drops where id = c.drop_id for update;
  update public.contributions set status = 'refunded' where id = c.id;
  if d.status not in ('cancelled', 'failed') then
    last_from_fan := not exists (select 1 from public.contributions
      where drop_id = c.drop_id and fan_id = c.fan_id and status = 'paid' and id <> c.id);
    update public.drops set
      raised_amount = greatest(raised_amount - c.amount, 0),
      contributor_count = greatest(contributor_count - (case when last_from_fan then 1 else 0 end), 0),
      status = case when status = 'unlocked' and raised_amount - c.amount < goal_amount then 'funding' else status end
    where id = d.id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 5. Drops past their deadline that missed the goal become 'failed' (fans are then refunded). Schedule daily.
create or replace function public.close_expired_drops() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.drops set status = 'failed'
   where status = 'funding' and deadline is not null and deadline < now() and raised_amount < goal_amount;
  get diagnostics n = row_count; return n;
end $$;
-- With pg_cron enabled (Database > Extensions):  select cron.schedule('close-expired-drops','5 * * * *','select public.close_expired_drops()');

-- 6. Lock the money functions to the service role.
revoke all on function public.mark_contribution_paid(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.mark_contribution_refunded(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.close_expired_drops() from public, anon, authenticated;
grant execute on function public.mark_contribution_paid(text, text, jsonb) to service_role;
grant execute on function public.mark_contribution_refunded(text, text, jsonb) to service_role;
grant execute on function public.close_expired_drops() to service_role;

notify pgrst, 'reload schema';
