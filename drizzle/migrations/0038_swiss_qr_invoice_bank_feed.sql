-- Payment reference used by the Swiss QR-bill is stored with the Stripe invoice row.
-- Bank-feed imports are separate from Stripe payments and never fulfill orders.
alter table public.manual_bank_payments
  add column stripe_payment_reference text;
alter table public.ticket_invoice_requests
  add column stripe_payment_reference text;

create table public.bank_feed_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (length(trim(provider)) between 1 and 80),
  provider_account_id text not null check (length(trim(provider_account_id)) between 1 and 160),
  provider_transaction_id text not null check (length(trim(provider_transaction_id)) between 1 and 200),
  booking_date date not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  payment_reference text not null check (length(trim(payment_reference)) between 1 and 140),
  status text not null default 'received' check (status in ('received', 'unmatched', 'ambiguous', 'mismatch', 'matched', 'reconciled')),
  stripe_invoice_id text,
  failure_reason text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_account_id, provider_transaction_id)
);
create index bank_feed_transactions_status_idx on public.bank_feed_transactions (status, created_at desc);
create index bank_feed_transactions_reference_idx on public.bank_feed_transactions (payment_reference);
create trigger bank_feed_transactions_touch before update on public.bank_feed_transactions
  for each row execute function public.touch_updated_at();
alter table public.bank_feed_transactions enable row level security;
revoke all on public.bank_feed_transactions from public, anon, authenticated;
grant all on public.bank_feed_transactions to service_role;
