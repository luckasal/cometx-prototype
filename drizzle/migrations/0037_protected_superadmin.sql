-- The designated owner keeps the existing admin permissions. This marker
-- prevents other CometX administrators from removing access or deleting her.
create table public.protected_superadmins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  protected_at timestamptz not null default now()
);

alter table public.protected_superadmins enable row level security;
revoke all on public.protected_superadmins from anon, authenticated, service_role;
grant select on public.protected_superadmins to service_role;

insert into public.protected_superadmins (user_id)
select u.id from auth.users u
join public.profiles p on p.id = u.id
join public.user_roles r on r.user_id = u.id and r.role::text = 'admin'
where lower(u.email) = 'lucia.salanicova@cometx.ch'
  and p.first_name = 'Lucia'
  and p.last_name = 'Salanicova Stara';

do $$
begin
  if not exists (
    select 1 from public.protected_superadmins p
    join auth.users u on u.id = p.user_id
    where lower(u.email) = 'lucia.salanicova@cometx.ch'
  ) then
    raise exception 'The verified CometX owner account and admin role were not found';
  end if;
end $$;

create function public.prevent_protected_admin_role_removal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role::text = 'admin'
    and exists (select 1 from public.protected_superadmins where user_id = old.user_id) then
    if tg_op = 'DELETE' then
      raise exception 'The protected superadmin role cannot be removed';
    end if;
    if new.user_id is distinct from old.user_id or new.role is distinct from old.role then
      raise exception 'The protected superadmin role cannot be changed';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

revoke all on function public.prevent_protected_admin_role_removal() from public, anon, authenticated;
create trigger protect_superadmin_role
before update or delete on public.user_roles
for each row execute function public.prevent_protected_admin_role_removal();
