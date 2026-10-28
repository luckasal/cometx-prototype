-- Keep contact records and their audit/history links while removing archived entries from active views.
ALTER TABLE public.contacts
  ADD COLUMN archived_at timestamptz;

CREATE INDEX contacts_archived_created_idx
  ON public.contacts (archived_at, created_at DESC);
