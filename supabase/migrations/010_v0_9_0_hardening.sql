-- DropLive v0.9.0 hardening. ADDITIVE and re-runnable. Run once after 009.
-- UNTESTED against a live database: run on a staging Supabase project first.

-- 1. Abuse protection: per-user hourly rate limits on inserts.
create or replace function public.enforce_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int := tg_argv[0]::int; col text := tg_argv[1]; uid uuid; n int;
begin
  execute 'select ($1).' || quote_ident(col) into uid using new;
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - interval ''1 hour''',
                 tg_table_schema, tg_table_name, col) into n using uid;
  if n >= lim then
    raise exception 'Rate limit reached. Please try again later.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists rl_drops on public.drops;
create trigger rl_drops before insert on public.drops
  for each row execute function public.enforce_rate_limit(10, 'creator_id');
drop trigger if exists rl_requests on public.drop_requests;
create trigger rl_requests before insert on public.drop_requests
  for each row execute function public.enforce_rate_limit(15, 'fan_id');
drop trigger if exists rl_contributions on public.contributions;
create trigger rl_contributions before insert on public.contributions
  for each row execute function public.enforce_rate_limit(30, 'fan_id');

-- 2. Input size limits (NOT VALID = applies to new/changed rows, never breaks old data).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'drops_len_chk') then
    alter table public.drops add constraint drops_len_chk
      check (char_length(title) between 3 and 120 and char_length(description) <= 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'requests_len_chk') then
    alter table public.drop_requests add constraint requests_len_chk
      check (char_length(title) between 3 and 120 and char_length(description) <= 1000
             and char_length(creator_name) <= 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_name_len_chk') then
    alter table public.profiles add constraint profiles_name_len_chk
      check (display_name is null or char_length(display_name) <= 60) not valid;
  end if;
end $$;

-- 3. Moderation: users can report a Drop, creator or request. Only the service role can read all reports.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('drop','creator','request')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports(status, created_at desc);
alter table public.reports enable row level security;
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports for insert with check (auth.uid() = reporter_id);
drop policy if exists "reports_read_own" on public.reports;
create policy "reports_read_own" on public.reports for select using (auth.uid() = reporter_id);
drop trigger if exists rl_reports on public.reports;
create trigger rl_reports before insert on public.reports
  for each row execute function public.enforce_rate_limit(10, 'reporter_id');

notify pgrst, 'reload schema';
