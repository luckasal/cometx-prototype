-- Preserve historical segment assignments while hiding archived segments from new assignments.
alter table public.contact_segments
  add column if not exists archived_at timestamptz;

create index if not exists contact_segments_active_name_idx
  on public.contact_segments (name) where archived_at is null;
