-- Store each successful annual invoice once, attaching the initial invoice to
-- the payment row already created by Checkout fulfillment.
begin;

alter table public.payments add column if not exists stripe_invoice_id text;
create unique index if not exists payments_stripe_invoice_id_unique
  on public.payments(stripe_invoice_id) where stripe_invoice_id is not null;

create or replace function public.record_cometx_membership_invoice_paid(p_invoice jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  invoice_id text := p_invoice->>'id';
  subscription_id text := coalesce(p_invoice->'parent'->'subscription_details'->>'subscription', p_invoice->>'subscription');
  membership_row public.memberships%rowtype;
  paid_minor bigint;
  payment_intent_id text := coalesce(
    p_invoice->>'cometx_payment_intent_id',
    p_invoice->'payment_intent'->>'id',
    p_invoice->>'payment_intent',
    p_invoice->'payments'->'data'->0->'payment'->'payment_intent'->>'id',
    p_invoice->'payments'->'data'->0->'payment'->>'payment_intent'
  );
  updated_count integer;
begin
  if p_invoice->>'livemode' is distinct from 'false'
    or p_invoice->>'object' is distinct from 'invoice'
    or p_invoice->>'status' is distinct from 'paid'
    or p_invoice->>'paid' is distinct from 'true'
    or coalesce(invoice_id,'') not like 'in_%'
    or coalesce(subscription_id,'') not like 'sub_%'
    or lower(coalesce(p_invoice->>'currency','')) <> 'chf'
    or coalesce(p_invoice->>'amount_paid','') !~ '^[0-9]+$' then
    raise exception 'Paid CometX test membership invoice required';
  end if;
  paid_minor := (p_invoice->>'amount_paid')::bigint;
  if paid_minor <= 0 then raise exception 'Membership invoice amount must be positive'; end if;

  select * into membership_row from public.memberships
    where stripe_subscription_id = subscription_id for update;
  if not found then raise exception 'CometX membership subscription not found'; end if;
  if exists (select 1 from public.payments where stripe_invoice_id = invoice_id) then return; end if;

  -- The initial checkout payment already has a row; link its Stripe invoice ID.
  if p_invoice->>'billing_reason' = 'subscription_create' then
    update public.payments set
      stripe_invoice_id = invoice_id,
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, payment_intent_id),
      invoice_url = coalesce(p_invoice->>'hosted_invoice_url', invoice_url)
    where id = (
      select id from public.payments
      where membership_id = membership_row.id and status = 'paid'
        and stripe_checkout_session_id is not null and stripe_invoice_id is null
      order by created_at desc limit 1 for update
    );
    get diagnostics updated_count = row_count;
    if updated_count > 0 then return; end if;
  end if;

  insert into public.payments (
    user_id, membership_id, stripe_customer_id, stripe_invoice_id,
    stripe_payment_intent_id, amount, currency, status, invoice_url
  ) values (
    membership_row.user_id, membership_row.id, p_invoice->>'customer', invoice_id,
    payment_intent_id, paid_minor::numeric / 100, 'CHF', 'paid', p_invoice->>'hosted_invoice_url'
  ) on conflict (stripe_invoice_id) where stripe_invoice_id is not null do nothing;
end $$;

revoke all on function public.record_cometx_membership_invoice_paid(jsonb) from public, anon, authenticated;
grant execute on function public.record_cometx_membership_invoice_paid(jsonb) to service_role;

commit;
