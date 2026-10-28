-- Reusable admin-managed contact segments. Assignments stay separate from
-- contact profile data so bulk changes cannot overwrite unrelated fields.
create table public.contact_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  slug text not null unique check (length(trim(slug)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.contact_segment_assignments (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  segment_id uuid not null references public.contact_segments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, segment_id)
);

create index contact_segment_assignments_segment_idx
  on public.contact_segment_assignments (segment_id, contact_id);

grant all on public.contact_segments, public.contact_segment_assignments to service_role;
grant select, insert, update, delete on public.contact_segments, public.contact_segment_assignments to authenticated;

alter table public.contact_segments enable row level security;
alter table public.contact_segment_assignments enable row level security;

create policy "contact segments admin access" on public.contact_segments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "contact segment assignments admin access" on public.contact_segment_assignments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
