-- DropLive creator discovery + following migration.
-- Additive migration: do not rerun the original schema or earlier migrations.

-- Let signed-in users discover profiles that opted into Creator or Both.
-- The existing profiles_select_own policy remains in place; policies are ORed.
drop policy if exists profiles_public_creator_discovery on public.profiles;
create policy profiles_public_creator_discovery
on public.profiles for select
using (role in ('creator','both'));

create table if not exists public.creator_follows (
  fan_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fan_id, creator_id),
  constraint creator_follows_not_self check (fan_id <> creator_id)
);

alter table public.creator_follows enable row level security;

drop policy if exists creator_follows_read_own on public.creator_follows;
create policy creator_follows_read_own
on public.creator_follows for select
using (auth.uid() = fan_id);

drop policy if exists creator_follows_insert_own on public.creator_follows;
create policy creator_follows_insert_own
on public.creator_follows for insert
with check (auth.uid() = fan_id and fan_id <> creator_id);

drop policy if exists creator_follows_delete_own on public.creator_follows;
create policy creator_follows_delete_own
on public.creator_follows for delete
using (auth.uid() = fan_id);
