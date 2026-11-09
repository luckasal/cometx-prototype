-- Stripe is the invoice authority. Existing payment and order rows remain unchanged.
alter table public.manual_bank_payments
  add column billing_email text,
  add column stripe_customer_id text,
  add column stripe_invoice_status text,
  add column invoice_pdf_url text,
  add column invoice_sent_at timestamptz,
  add column paid_outside_confirmed_by uuid references auth.users(id),
  add column paid_outside_confirmed_at timestamptz,
  add column paid_outside_note text;

alter table public.ticket_invoice_requests
  add column billing_email text,
  add column stripe_customer_id text,
  add column stripe_invoice_status text,
  add column invoice_pdf_url text,
  add column invoice_sent_at timestamptz,
  add column paid_outside_confirmed_by uuid references auth.users(id),
  add column paid_outside_confirmed_at timestamptz,
  add column paid_outside_note text;

alter table public.manual_bank_payments add constraint manual_bank_invoice_email_check
  check (billing_email is null or billing_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
alter table public.ticket_invoice_requests add constraint ticket_invoice_email_check
  check (billing_email is null or billing_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
