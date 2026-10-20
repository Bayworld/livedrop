-- DropLive v0.6.1 pilot hardening. ADDITIVE and re-runnable. Run once after v0.4.0 and v0.5.0.
-- 1) Pledges are refused after a Drop's deadline. 2) Goal/contribution amounts are locked once any fan has pledged.

drop policy if exists "contributions_own_insert" on public.contributions;
create policy "contributions_own_insert" on public.contributions for insert
  with check (
    auth.uid() = fan_id and status = 'pending' and paid_at is null
    and provider_reference is null and payment_provider is null
    and exists (select 1 from public.drops d
                where d.id = drop_id and d.status in ('funding','unlocked','live')
                  and (d.deadline is null or d.deadline > now())
                  and d.creator_id <> auth.uid() and amount >= d.contribution_amount)
  );

create or replace function public.drops_guard_client_writes() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
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
-- Verify: select policyname, with_check from pg_policies where tablename='contributions' and policyname='contributions_own_insert';  (should mention deadline)
-- Then run: notify pgrst, 'reload schema';
