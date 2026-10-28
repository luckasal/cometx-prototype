-- Complete the small manual-payment/invoice record after migration 0034.
-- These columns retain the actor and time of recording and invoice edits.
alter table public.manual_bank_payments
  rename column verified_by to recorded_by;
alter table public.manual_bank_payments
  rename column verified_at to recorded_at;
alter table public.manual_bank_payments
  add column event_order_reference text check (event_order_reference is null or length(trim(event_order_reference)) between 1 and 240),
  add column external_invoice_id text,
  add column invoice_updated_by uuid references auth.users(id),
  add column invoice_updated_at timestamptz;

alter table public.ticket_invoice_requests
  rename column status to invoice_status;
alter table public.ticket_invoice_requests
  add column invoice_requested boolean not null default true check (invoice_requested),
  add column external_invoice_id text,
  add column invoice_updated_by uuid references auth.users(id),
  add column invoice_updated_at timestamptz;

alter table public.manual_bank_payments drop constraint manual_bank_payments_check;
alter table public.manual_bank_payments add constraint manual_bank_payments_billing_check
  check (invoice_status <> 'requested' or (nullif(trim(billing_name), '') is not null and nullif(trim(billing_address), '') is not null));
alter table public.manual_bank_payments drop constraint manual_bank_payments_check2;
alter table public.manual_bank_payments add constraint manual_bank_payments_issued_invoice_check
  check (invoice_status <> 'issued' or ((stripe_invoice_id is not null or external_invoice_id is not null or invoice_url is not null)
    and invoice_issued_by is not null and invoice_issued_at is not null));
alter table public.ticket_invoice_requests drop constraint ticket_invoice_requests_check;
alter table public.ticket_invoice_requests add constraint ticket_invoice_requests_issued_invoice_check
  check (invoice_status <> 'issued' or ((stripe_invoice_id is not null or external_invoice_id is not null or invoice_url is not null)
    and issued_by is not null and issued_at is not null));
