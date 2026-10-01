-- Preserve who checked an issued event ticket in at the door.
-- Apply only after the coordinated 0007-0009 order/attendee migrations.
begin;

alter table public.ticket_attendees
  add column checked_in_at timestamptz,
  add column checked_in_by uuid references auth.users(id) on delete set null;

comment on column public.ticket_attendees.checked_in_at is
  'Server-recorded time an administrator checked this issued ticket in.';
comment on column public.ticket_attendees.checked_in_by is
  'Administrator account that checked this issued ticket in.';

commit;
