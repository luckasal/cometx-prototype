-- Archived entitlement definitions stay readable so existing assignments keep
-- their meaning, but Back Office prevents attaching them to new records.
alter table public.entitlements
  add column if not exists archived_at timestamptz;
