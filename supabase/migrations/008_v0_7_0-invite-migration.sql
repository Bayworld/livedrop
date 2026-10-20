-- DropLive v0.7.0. ADDITIVE and re-runnable. Run once after v0.6.1.
-- Returns ONLY a number: how many open requests exist for a creator name that is not routed to a registered creator.
-- Used by the invite page (?invite=Name). No request content or fan identity is exposed.
create or replace function public.creator_request_count(p_name text)
returns integer language sql security definer set search_path = public stable as $$
  select count(*)::int from public.drop_requests
  where creator_id is null and status = 'open'
    and lower(trim(creator_name)) = lower(trim(p_name));
$$;
revoke all on function public.creator_request_count(text) from public;
grant execute on function public.creator_request_count(text) to anon, authenticated;
notify pgrst, 'reload schema';
