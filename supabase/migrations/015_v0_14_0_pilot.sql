-- DropLive v0.14.0 PILOT. Re-runnable. Run after 014.
-- 1) A Drop cannot go live without a session link.  2) While payments are OFF, the Drop's creator can mark a pledge paid
--    (manual pilot confirmation, e.g. after a bank transfer). Both are enforced here, not in the browser.

create or replace function public.set_drop_phase(p_drop_id uuid, p_phase text) returns text
language plpgsql security definer set search_path = public as $$
declare d public.drops; pay boolean; link text;
begin
  select * into d from public.drops where id = p_drop_id for update;
  if not found or d.creator_id is distinct from auth.uid() then raise exception 'Drop not found.'; end if;
  select coalesce((select value = 'true' from public.app_settings where key = 'payments_enabled'), false) into pay;
  if p_phase = 'live' then
    if not (d.status = 'unlocked' or (not pay and d.status = 'funding')) then
      raise exception 'A Drop can only go live once its goal is funded.';
    end if;
    select session_url into link from public.drop_delivery where drop_id = d.id;
    if link is null or length(trim(link)) = 0 then
      raise exception 'Add your session link first (Edit the Drop, then paste a Google Meet or Zoom link).';
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

create or replace function public.creator_mark_pledge_paid(p_contribution_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c public.contributions; d public.drops; pay boolean; first_from_fan boolean;
begin
  select coalesce((select value = 'true' from public.app_settings where key = 'payments_enabled'), false) into pay;
  if pay then raise exception 'Manual confirmation is only available while payments are off.'; end if;
  select * into c from public.contributions where id = p_contribution_id for update;
  if not found then raise exception 'Pledge not found.'; end if;
  select * into d from public.drops where id = c.drop_id for update;
  if d.creator_id is distinct from auth.uid() then raise exception 'Pledge not found.'; end if;
  if c.status = 'paid' then return 'already'; end if;
  if c.status <> 'pending' then raise exception 'Only a pending pledge can be confirmed.'; end if;
  if d.status in ('cancelled','failed','completed') then raise exception 'This Drop is closed.'; end if;
  first_from_fan := not exists (select 1 from public.contributions
    where drop_id = c.drop_id and fan_id = c.fan_id and status = 'paid' and id <> c.id);
  update public.contributions set status = 'paid', paid_at = now() where id = c.id;
  perform set_config('droplive.phase_change', '1', true);
  update public.drops set
    raised_amount = raised_amount + c.amount,
    contributor_count = contributor_count + (case when first_from_fan then 1 else 0 end),
    status = case when status = 'funding' and raised_amount + c.amount >= goal_amount then 'unlocked' else status end
  where id = d.id;
  perform set_config('droplive.phase_change', '0', true);
  perform public.notify_users(array[c.fan_id], 'pledge_confirmed', 'Your pledge is confirmed',
    left('You now have access to "' || coalesce(d.title, 'the session') || '". Open it for the session link and to ask questions.', 200), '?drop=' || d.id::text);
  return 'paid';
end $$;
revoke all on function public.creator_mark_pledge_paid(uuid) from public, anon;
grant execute on function public.creator_mark_pledge_paid(uuid) to authenticated;
notify pgrst, 'reload schema';
