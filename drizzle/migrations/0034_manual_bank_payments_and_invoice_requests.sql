-- Finance-confirmed bank receipts are evidence only. They never enter the
-- Stripe payments ledger or trigger order, ticket or membership fulfillment.
create table public.manual_bank_payments (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  paid_on date not null,
  reference text not null check (length(trim(reference)) between 1 and 240),
  note text,
  status text not null default 'paid' check (status in ('paid', 'void')),
  verified_by uuid not null references auth.users(id),
  verified_at timestamptz not null default now(),
  voided_by uuid references auth.users(id),
  voided_at timestamptz,
  void_reason text,
  invoice_requested boolean not null default false,
  invoice_requested_by uuid references auth.users(id),
  invoice_requested_at timestamptz,
  billing_name text,
  billing_address text,
  vat_uid text,
  invoice_note text,
  invoice_status text not null default 'none' check (invoice_status in ('none', 'requested', 'issued')),
  stripe_invoice_id text unique,
  invoice_url text,
  invoice_issued_by uuid references auth.users(id),
  invoice_issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not invoice_requested or (nullif(trim(billing_name), '') is not null and nullif(trim(billing_address), '') is not null)),
  check ((not invoice_requested and invoice_status = 'none') or (invoice_requested and invoice_status <> 'none')),
  check (invoice_status <> 'issued' or (stripe_invoice_id is not null and invoice_url is not null and invoice_issued_by is not null and invoice_issued_at is not null)),
  check ((status = 'paid' and voided_at is null and voided_by is null) or (status = 'void' and voided_at is not null and voided_by is not null and nullif(trim(void_reason), '') is not null))
);
create index manual_bank_payments_paid_on_idx on public.manual_bank_payments (paid_on desc, created_at desc);
create index manual_bank_payments_partner_idx on public.manual_bank_payments (partner_id, paid_on desc);
create trigger manual_bank_payments_touch before update on public.manual_bank_payments
  for each row execute function public.touch_updated_at();
alter table public.manual_bank_payments enable row level security;
revoke all on public.manual_bank_payments from public, anon, authenticated;
grant all on public.manual_bank_payments to service_role;

-- One request per checkout batch; Stripe Invoicing remains invoice authority.
create table public.ticket_invoice_requests (
  id uuid primary key default gen_random_uuid(),
  checkout_batch_id uuid not null unique references public.ticket_checkout_batches(id),
  billing_name text not null check (length(trim(billing_name)) between 1 and 240),
  billing_address text not null check (length(trim(billing_address)) between 1 and 1000),
  vat_uid text,
  note text,
  status text not null default 'requested' check (status in ('requested', 'issued')),
  stripe_invoice_id text unique,
  invoice_url text,
  issued_by uuid references auth.users(id),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'issued' or (stripe_invoice_id is not null and invoice_url is not null and issued_by is not null and issued_at is not null))
);
create index ticket_invoice_requests_created_idx on public.ticket_invoice_requests (created_at desc);
create trigger ticket_invoice_requests_touch before update on public.ticket_invoice_requests
  for each row execute function public.touch_updated_at();
alter table public.ticket_invoice_requests enable row level security;
revoke all on public.ticket_invoice_requests from public, anon, authenticated;
grant all on public.ticket_invoice_requests to service_role;
