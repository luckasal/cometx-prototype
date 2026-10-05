-- Keep the verified CometXXL checkout contract separate from legacy one-time plans.
alter table public.membership_plans
  add column billing_interval text,
  add column setup_fee numeric(10,2) not null default 0,
  add column stripe_recurring_price_id text,
  add column stripe_setup_price_id text;

alter table public.membership_plans
  add constraint membership_plans_billing_interval_check
    check (billing_interval is null or billing_interval in ('day','week','month','year')),
  add constraint membership_plans_setup_fee_check check (setup_fee >= 0);

update public.membership_plans
set annual_price = 250,
    currency = 'CHF',
    billing_interval = 'year',
    setup_fee = 1.99
where slug = 'cometxxl';

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_plan_id uuid not null references public.membership_plans(id),
  email text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  nationality text not null check (nationality in ('slovak','czech','other')),
  motivation text not null check (length(trim(motivation)) between 1 and 3000),
  missing_from_subscription text not null check (length(trim(missing_from_subscription)) between 1 and 3000),
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled')),
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index membership_applications_user_idx on public.membership_applications(user_id, created_at desc);
alter table public.membership_applications enable row level security;
revoke all on public.membership_applications from public, anon;
grant select on public.membership_applications to authenticated;
grant all on public.membership_applications to service_role;
create policy "own membership applications read" on public.membership_applications
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create trigger membership_applications_touch before update on public.membership_applications
  for each row execute function public.touch_updated_at();

-- Signed Checkout completion, amount validation, membership activation and ledger write are atomic.
create or replace function public.fulfill_cometx_membership_application(p_session jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  session_id text := p_session->>'id';
  app_id uuid := nullif(p_session->'metadata'->>'membership_application_id','')::uuid;
  app public.membership_applications%rowtype;
  plan public.membership_plans%rowtype;
  membership_id uuid;
  inserted integer;
  expected_minor bigint;
  amount numeric(10,2);
  currency_code text;
  subscription_id text := p_session->>'subscription';
begin
  if p_session->>'livemode' is distinct from 'false'
    or p_session->>'payment_status' is distinct from 'paid'
    or p_session->'metadata'->>'kind' is distinct from 'membership_application'
    or coalesce(session_id,'') = '' or app_id is null then
    raise exception 'Paid CometX membership test session required';
  end if;
  select * into app from public.membership_applications where id=app_id for update;
  if not found then raise exception 'Membership application not found'; end if;
  if p_session->'metadata'->>'membership_plan_id' is distinct from app.membership_plan_id::text
    or p_session->'metadata'->>'user_id' is distinct from app.user_id::text then
    raise exception 'Membership application metadata mismatch';
  end if;
  if app.stripe_checkout_session_id is not null and app.stripe_checkout_session_id <> session_id then
    raise exception 'Checkout session does not match application';
  end if;
  if app.status = 'paid' then return; end if;
  if app.status <> 'pending' then raise exception 'Membership application is not payable'; end if;
  select * into plan from public.membership_plans where id=app.membership_plan_id and active for update;
  if not found or plan.billing_interval <> 'year' then raise exception 'Membership plan is not configured for recurring checkout'; end if;
  expected_minor := round((plan.annual_price + plan.setup_fee) * 100);
  if coalesce(p_session->>'amount_total','') !~ '^[0-9]+$'
    or coalesce(p_session->'metadata'->>'expected_amount','') !~ '^[0-9]+$'
    or coalesce(p_session->>'currency','') = ''
    or coalesce(p_session->'metadata'->>'expected_currency','') = ''
    or (p_session->>'amount_total')::bigint <> expected_minor
    or lower(p_session->>'currency') is distinct from lower(plan.currency)
    or (p_session->'metadata'->>'expected_amount')::bigint <> expected_minor
    or lower(p_session->'metadata'->>'expected_currency') is distinct from lower(plan.currency) then
    raise exception 'Membership Checkout amount mismatch';
  end if;
  if coalesce(subscription_id,'') = '' then raise exception 'Missing membership subscription'; end if;
  insert into public.stripe_checkout_receipts(session_id) values(session_id) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;
  perform 1 from auth.users where id=app.user_id for update;
  if not found then raise exception 'Membership applicant not found'; end if;
  update public.memberships set status='inactive'
    where user_id=app.user_id and status in ('active','past_due');
  currency_code := upper(p_session->>'currency');
  amount := (p_session->>'amount_total')::numeric / 100;
  insert into public.memberships(user_id,membership_plan_id,status,starts_at,ends_at,stripe_customer_id,stripe_subscription_id)
  values(app.user_id,app.membership_plan_id,'active',now(),now()+interval '1 year',p_session->>'customer',subscription_id)
  returning id into membership_id;
  insert into public.payments(user_id,membership_id,stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,amount,currency,status)
  values(app.user_id,membership_id,p_session->>'customer',session_id,p_session->>'payment_intent',amount,currency_code,'paid')
  ;
  update public.membership_applications set status='paid',stripe_checkout_session_id=session_id,stripe_subscription_id=subscription_id
    where id=app.id;
end $$;
revoke all on function public.fulfill_cometx_membership_application(jsonb) from public, anon, authenticated;
grant execute on function public.fulfill_cometx_membership_application(jsonb) to service_role;

-- Keep access aligned with Stripe's recurring subscription lifecycle; replaying an event is safe.
create or replace function public.sync_cometx_membership_subscription(p_subscription jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  subscription_id text := p_subscription->>'id';
  stripe_status text := p_subscription->>'status';
  rows_changed integer;
begin
  if p_subscription->>'livemode' is distinct from 'false' or coalesce(subscription_id,'') = '' then
    raise exception 'CometX test membership subscription required';
  end if;
  update public.memberships set
    status = case stripe_status
      when 'active' then 'active'::public.membership_status
      when 'past_due' then 'past_due'::public.membership_status
      when 'unpaid' then 'past_due'::public.membership_status
      when 'canceled' then 'cancelled'::public.membership_status
      else 'inactive'::public.membership_status
    end,
    ends_at = coalesce(to_timestamp(nullif(p_subscription->>'current_period_end','')::bigint), ends_at)
  where stripe_subscription_id=subscription_id;
  get diagnostics rows_changed = row_count;
  if rows_changed = 0 then raise exception 'CometX membership subscription not found'; end if;
end $$;
revoke all on function public.sync_cometx_membership_subscription(jsonb) from public, anon, authenticated;
grant execute on function public.sync_cometx_membership_subscription(jsonb) to service_role;

commit;
