-- Profiles stay private by default. Back Office staff can explicitly publish
-- a profile in the public member directory; the public endpoint returns only
-- name, company, job title, and country.
alter table public.profiles
  add column if not exists public_directory_visible boolean not null default false,
  add column if not exists public_directory_visibility_changed_at timestamptz,
  add column if not exists public_directory_visibility_changed_by uuid references auth.users(id) on delete set null;

create or replace function public.prevent_profile_visibility_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.public_directory_visible is distinct from old.public_directory_visible
    and coalesce(auth.role(), '') not in ('service_role', 'supabase_admin')
    and session_user not in ('postgres', 'supabase_admin')
    and not public.is_admin()
  then
    raise exception 'Only authorized CometX staff can change public profile visibility'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_profile_visibility_self_change() from public, anon, authenticated;

drop trigger if exists profiles_guard_public_visibility on public.profiles;
create trigger profiles_guard_public_visibility
before update of public_directory_visible on public.profiles
for each row execute function public.prevent_profile_visibility_self_change();
