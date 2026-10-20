-- DropLive marketplace migration
-- Run this once in Supabase SQL Editor after the original schema.

create table if not exists public.drop_requests (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid not null references public.profiles(id) on delete cascade,
  creator_name text not null,
  title text not null,
  description text not null default '',
  willing_amount bigint not null check (willing_amount > 0),
  potential_supporters integer not null default 1 check (potential_supporters > 0),
  status text not null default 'open' check (status in ('open','accepted','declined','converted','closed')),
  created_at timestamptz not null default now()
);
create index if not exists drop_requests_fan_id_idx on public.drop_requests(fan_id);
create index if not exists drop_requests_creator_name_idx on public.drop_requests(creator_name);
create index if not exists drop_requests_status_idx on public.drop_requests(status);
alter table public.drop_requests enable row level security;
drop policy if exists "drop_requests_own_read" on public.drop_requests;
create policy "drop_requests_own_read" on public.drop_requests for select using (auth.uid() = fan_id);
drop policy if exists "drop_requests_own_insert" on public.drop_requests;
create policy "drop_requests_own_insert" on public.drop_requests for insert with check (auth.uid() = fan_id);
