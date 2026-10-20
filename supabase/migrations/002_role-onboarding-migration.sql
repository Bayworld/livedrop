-- DropLive v0.3.9 account role and creator onboarding migration
-- Additive: does not delete or recreate user data. Run once in Supabase SQL Editor.
-- Ensures new confirmed accounts get a profile role from auth user metadata.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    case when new.raw_user_meta_data->>'role' in ('fan','creator','both') then new.raw_user_meta_data->>'role' else 'fan' end
  )
  on conflict (id) do update set
    display_name = coalesce(nullif(trim(public.profiles.display_name), ''), excluded.display_name);
  return new;
end;
$$;

-- Backfill metadata-selected roles for existing profiles only when valid.
update public.profiles p
set role = u.raw_user_meta_data->>'role'
from auth.users u
where p.id = u.id
  and u.raw_user_meta_data->>'role' in ('fan','creator','both')
  and coalesce(p.role, '') = 'fan'
  and coalesce(u.raw_user_meta_data->>'role','') <> 'fan';
