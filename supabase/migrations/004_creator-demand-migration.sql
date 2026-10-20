-- DropLive creator demand inbox migration
-- Run once in Supabase SQL Editor after the marketplace migration.

alter table public.drop_requests
  add column if not exists creator_id uuid references public.profiles(id) on delete set null;

create index if not exists drop_requests_creator_id_idx on public.drop_requests(creator_id);

-- Backfill older requests when the creator name already matches a profile.
update public.drop_requests r
set creator_id = p.id
from public.profiles p
where r.creator_id is null
  and lower(trim(r.creator_name)) = lower(trim(p.display_name));

alter table public.drop_requests enable row level security;

drop policy if exists "drop_requests_creator_read" on public.drop_requests;
create policy "drop_requests_creator_read"
on public.drop_requests for select
using (auth.uid() = fan_id or auth.uid() = creator_id);

drop policy if exists "drop_requests_creator_update" on public.drop_requests;
create policy "drop_requests_creator_update"
on public.drop_requests for update
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);
