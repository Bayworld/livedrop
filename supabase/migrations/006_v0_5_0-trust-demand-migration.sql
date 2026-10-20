-- DropLive v0.5.0: usernames, manual verified badge, fans backing requests.
-- ADDITIVE and re-runnable. Run once AFTER the v0.4.0 migration. Does not touch existing rows' data.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists verified boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$');
  end if;
end $$;
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;

-- Browsers can never grant themselves "verified". Only you, in the SQL Editor, can:
--   update public.profiles set verified = true where id = '<creator uuid>';
create or replace function public.profiles_guard_verified() returns trigger language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then new.verified := false; else new.verified := old.verified; end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles for each row execute function public.profiles_guard_verified();

create or replace view public.public_creator_profiles as
select p.id, p.display_name, p.avatar_url, p.role, p.username, p.verified
from public.profiles p
where p.role in ('creator','both') or exists (select 1 from public.drops d where d.creator_id = p.id);
grant select on public.public_creator_profiles to anon, authenticated;

-- Fans can back an existing request (a non-binding demand signal; no money moves).
create table if not exists public.request_pledges (
  request_id uuid not null references public.drop_requests(id) on delete cascade,
  fan_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (request_id, fan_id)
);
alter table public.request_pledges enable row level security;
drop policy if exists request_pledges_read on public.request_pledges;
create policy request_pledges_read on public.request_pledges for select
  using (auth.uid() = fan_id or exists (select 1 from public.drop_requests r where r.id = request_id and r.creator_id = auth.uid()));
drop policy if exists request_pledges_insert on public.request_pledges;
create policy request_pledges_insert on public.request_pledges for insert
  with check (auth.uid() = fan_id and exists (select 1 from public.drop_requests r where r.id = request_id and r.status = 'open' and r.creator_id is not null and r.fan_id <> auth.uid()));
drop policy if exists request_pledges_delete on public.request_pledges;
create policy request_pledges_delete on public.request_pledges for delete using (auth.uid() = fan_id);

-- Public demand board: open requests for registered creators, with totals. Never exposes the requesting fan.
create or replace view public.public_open_requests as
select r.id, r.creator_id, r.creator_name, r.title, r.description, r.willing_amount, r.created_at,
       1 + (select count(*) from public.request_pledges q where q.request_id = r.id) as backers,
       r.willing_amount + coalesce((select sum(q.amount) from public.request_pledges q where q.request_id = r.id), 0) as interest_total
from public.drop_requests r
where r.status = 'open' and r.creator_id is not null;
grant select on public.public_open_requests to anon, authenticated;

-- Verify: select column_name from information_schema.columns where table_name='profiles' and column_name in ('username','verified');
-- Rollback: drop view public.public_open_requests; drop table public.request_pledges; (username/verified columns can stay unused.)
