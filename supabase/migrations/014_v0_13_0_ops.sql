-- DropLive v0.13.0: earnings view, one-hour reminders, scheduled jobs. ADDITIVE and re-runnable. Run after 013.
-- UNTESTED against a live database: run on a staging Supabase project first.

-- 1. Platform fee (percent of paid contributions kept by DropLive). Change the value to your real fee.
insert into public.app_settings(key, value) values ('platform_fee_pct', '10') on conflict (key) do nothing;

-- 2. Creator earnings: one row per Drop for the signed-in creator.
create or replace function public.creator_earnings()
returns table(drop_id uuid, title text, status text, created_at timestamptz, paid_count bigint, gross bigint, refunded bigint, fee bigint, net bigint)
language sql stable security definer set search_path = public as $$
  with p as (select coalesce((select nullif(value,'')::numeric from public.app_settings where key = 'platform_fee_pct'), 10) as pct),
  t as (
    select d.id, d.title, d.status::text as status, d.created_at,
           count(c.id) filter (where c.status = 'paid') as paid_count,
           coalesce(sum(c.amount) filter (where c.status = 'paid'), 0)::bigint as gross,
           coalesce(sum(c.amount) filter (where c.status = 'refunded'), 0)::bigint as refunded
    from public.drops d left join public.contributions c on c.drop_id = d.id
    where d.creator_id = auth.uid()
    group by d.id)
  select t.id, t.title, t.status, t.created_at, t.paid_count, t.gross, t.refunded,
         round(t.gross * p.pct / 100)::bigint, (t.gross - round(t.gross * p.pct / 100))::bigint
  from t, p order by t.created_at desc;
$$;
revoke all on function public.creator_earnings() from public, anon;
grant execute on function public.creator_earnings() to authenticated;

-- 3. One-hour reminders. Inserts in-app notifications (the notify-email Edge Function turns each into an email).
create table if not exists public.drop_reminders (drop_id uuid primary key references public.drops(id) on delete cascade, sent_at timestamptz not null default now());
alter table public.drop_reminders enable row level security;   -- no policies: only the function below touches it

create or replace function public.queue_drop_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare d record; n integer := 0; users uuid[];
begin
  for d in
    select id, creator_id, title from public.drops
    where status in ('funding','unlocked','live') and scheduled_at is not null
      and scheduled_at > now() and scheduled_at <= now() + interval '60 minutes'
      and not exists (select 1 from public.drop_reminders r where r.drop_id = drops.id)
  loop
    select coalesce(array_agg(distinct c.fan_id), '{}') into users from public.contributions c where c.drop_id = d.id and c.status = 'paid';
    perform public.notify_users(array_append(users, d.creator_id), 'reminder',
      left('Starting within an hour: ' || d.title, 160), 'Get ready. Open the Drop page to join when it goes live.', '?drop=' || d.id::text);
    insert into public.drop_reminders(drop_id) values (d.id) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.queue_drop_reminders() from public, anon, authenticated;

-- 4. Schedules (needs the pg_cron extension: Dashboard > Database > Extensions > pg_cron). Safe to re-run.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if to_regproc('public.close_expired_drops()') is not null then
      perform cron.schedule('droplive-close-expired', '*/5 * * * *', 'select public.close_expired_drops()');
    else
      raise notice 'close_expired_drops() not found (it ships in migration 012, run at payment launch). Re-run this migration after 012 to schedule it.';
    end if;
    perform cron.schedule('droplive-reminders', '*/5 * * * *', 'select public.queue_drop_reminders()');
  else
    raise notice 'pg_cron is not enabled. Enable it, then re-run this migration to create the schedules.';
  end if;
end $$;
notify pgrst, 'reload schema';
