-- DropLive v0.15.0. Re-runnable. Run after 015.
-- 1) Drops get a category, so the Explore filters work for real Drops.
-- 2) A fan can hold only one pending pledge per Drop. Without this, repeated taps stacked duplicate
--    pending rows and a creator confirming each one inflated raised_amount.
-- 3) Index for the Explore query (status + newest first).

alter table public.drops add column if not exists category text not null default 'other';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'drops_category_chk') then
    alter table public.drops add constraint drops_category_chk
      check (category in ('music','entertainment','business','faith','lifestyle','other')) not valid;
  end if;
end $$;

-- Collapse any existing duplicate pending pledges before the unique index goes on (keeps the earliest).
delete from public.contributions c
using public.contributions k
where c.status = 'pending' and k.status = 'pending'
  and c.drop_id = k.drop_id and c.fan_id = k.fan_id
  and (c.created_at, c.id) > (k.created_at, k.id);

create unique index if not exists contributions_one_pending_per_fan
  on public.contributions (drop_id, fan_id) where status = 'pending';

create index if not exists drops_status_created_idx on public.drops (status, created_at desc);

notify pgrst, 'reload schema';
