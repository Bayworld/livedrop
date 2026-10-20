-- DropLive v0.8.0 session delivery. ADDITIVE and re-runnable. Run once after v0.7.0.
-- Session link/notes are private: creator (Drop owner) can read/write; a fan can read ONLY after their pledge is marked 'paid'.
create table if not exists public.drop_delivery (
  drop_id uuid primary key references public.drops(id) on delete cascade,
  session_url text check (session_url is null or session_url ~* '^https://'),
  notes text check (notes is null or length(notes) <= 1000),
  updated_at timestamptz not null default now()
);
alter table public.drop_delivery enable row level security;
drop policy if exists "delivery_owner_all" on public.drop_delivery;
create policy "delivery_owner_all" on public.drop_delivery for all
  using (exists (select 1 from public.drops d where d.id = drop_id and d.creator_id = auth.uid()))
  with check (exists (select 1 from public.drops d where d.id = drop_id and d.creator_id = auth.uid()));
drop policy if exists "delivery_paid_fan_read" on public.drop_delivery;
create policy "delivery_paid_fan_read" on public.drop_delivery for select
  using (exists (select 1 from public.contributions c where c.drop_id = drop_delivery.drop_id and c.fan_id = auth.uid() and c.status = 'paid'));
notify pgrst, 'reload schema';
-- Concierge testing: after you receive a fan's payment manually, run in the SQL editor:
--   update public.contributions set status='paid', paid_at=now() where id='<contribution uuid>';
