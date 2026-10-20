-- DropLive v0.12.0 live room: questions + ratings. ADDITIVE, re-runnable. Run after 012.
-- Only the Drop's creator and fans with a PAID pledge can use these. Before payments are on, mark a pledge paid manually to test.
create table if not exists public.drop_questions (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops(id) on delete cascade,
  fan_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 2 and 300),
  answered boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists drop_questions_drop_idx on public.drop_questions(drop_id, created_at);
alter table public.drop_questions enable row level security;
drop policy if exists "dq_read" on public.drop_questions;
create policy "dq_read" on public.drop_questions for select using (
  fan_id = auth.uid() or exists (select 1 from public.drops d where d.id = drop_id and d.creator_id = auth.uid()));
drop policy if exists "dq_insert_paid_fan" on public.drop_questions;
create policy "dq_insert_paid_fan" on public.drop_questions for insert with check (
  fan_id = auth.uid()
  and exists (select 1 from public.contributions c where c.drop_id = drop_questions.drop_id and c.fan_id = auth.uid() and c.status = 'paid')
  and exists (select 1 from public.drops d where d.id = drop_questions.drop_id and d.status in ('funding','unlocked','live')));
drop policy if exists "dq_creator_update" on public.drop_questions;
create policy "dq_creator_update" on public.drop_questions for update
  using (exists (select 1 from public.drops d where d.id = drop_id and d.creator_id = auth.uid()))
  with check (exists (select 1 from public.drops d where d.id = drop_id and d.creator_id = auth.uid()));

create table if not exists public.drop_ratings (
  drop_id uuid not null references public.drops(id) on delete cascade,
  fan_id uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  primary key (drop_id, fan_id)
);
alter table public.drop_ratings enable row level security;
drop policy if exists "dr_read" on public.drop_ratings;
create policy "dr_read" on public.drop_ratings for select using (
  fan_id = auth.uid() or exists (select 1 from public.drops d where d.id = drop_id and d.creator_id = auth.uid()));
drop policy if exists "dr_insert_paid_fan" on public.drop_ratings;
create policy "dr_insert_paid_fan" on public.drop_ratings for insert with check (
  fan_id = auth.uid()
  and exists (select 1 from public.contributions c where c.drop_id = drop_ratings.drop_id and c.fan_id = auth.uid() and c.status = 'paid')
  and exists (select 1 from public.drops d where d.id = drop_ratings.drop_id and d.status = 'completed'));
notify pgrst, 'reload schema';
