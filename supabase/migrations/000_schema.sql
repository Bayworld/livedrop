-- DropLive V0.2 database schema
-- Run this in a fresh Supabase project's SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'fan' check (role in ('fan','creator','both')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.drops (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  goal_amount bigint not null check (goal_amount > 0),
  contribution_amount bigint not null check (contribution_amount > 0),
  scheduled_at timestamptz,
  deadline timestamptz,
  status text not null default 'funding' check (status in ('draft','funding','unlocked','live','completed','failed','cancelled')),
  raised_amount bigint not null default 0 check (raised_amount >= 0),
  contributor_count integer not null default 0 check (contributor_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops(id) on delete cascade,
  fan_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  currency text not null default 'NGN',
  payment_provider text,
  provider_reference text unique,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists drops_creator_id_idx on public.drops(creator_id);
create index if not exists drops_status_idx on public.drops(status);
create index if not exists contributions_drop_id_idx on public.contributions(drop_id);
create index if not exists contributions_fan_id_idx on public.contributions(fan_id);

alter table public.profiles enable row level security;
alter table public.drops enable row level security;
alter table public.contributions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

drop policy if exists "drops_public_read" on public.drops;
create policy "drops_public_read" on public.drops for select using (true);

drop policy if exists "drops_creator_insert" on public.drops;
create policy "drops_creator_insert" on public.drops for insert with check (auth.uid() = creator_id);

drop policy if exists "drops_creator_update" on public.drops;
create policy "drops_creator_update" on public.drops for update using (auth.uid() = creator_id);

drop policy if exists "contributions_own_read" on public.contributions;
create policy "contributions_own_read" on public.contributions for select using (auth.uid() = fan_id or auth.uid() = (select creator_id from public.drops where drops.id = contributions.drop_id));

drop policy if exists "contributions_own_insert" on public.contributions;
create policy "contributions_own_insert" on public.contributions for insert with check (auth.uid() = fan_id);

-- Automatically create a profile row for new authenticated users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Fan demand requests: a request is a demand signal, not a payment.
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
