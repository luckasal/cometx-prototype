-- The three CometX tiers are annual subscriptions. Existing memberships and
-- historical payments remain unchanged; this governs new purchases only.
begin;

do $$
begin
  if (select count(*) from public.membership_plans where slug in ('fanousek','cometxxl','ambasador')) <> 3
    or exists (select 1 from public.membership_plans where slug not in ('fanousek','cometxxl','ambasador')) then
    raise exception 'Unexpected membership catalogue; review before changing billing';
  end if;
end $$;

update public.membership_plans
set billing_interval = 'year', setup_fee = 1.99
where slug in ('fanousek','cometxxl','ambasador')
  and (billing_interval is distinct from 'year' or setup_fee is distinct from 1.99);

alter table public.membership_plans
  add constraint membership_plans_annual_setup_fee_check
  check (billing_interval = 'year' and setup_fee = 1.99);

-- Stripe's current API has per-item periods, not subscription-level periods.
create or replace function public.sync_cometx_membership_subscription(p_subscription jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  subscription_id text := p_subscription->>'id';
  stripe_status text := p_subscription->>'status';
  period_end bigint;
  rows_changed integer;
begin
  if p_subscription->>'livemode' is distinct from 'false'
    or coalesce(subscription_id,'') not like 'sub_%' then
    raise exception 'CometX test membership subscription required';
  end if;
  select max(nullif(item->>'current_period_end','')::bigint) into period_end
    from jsonb_array_elements(coalesce(p_subscription->'items'->'data','[]'::jsonb)) item;
  if period_end is null then
    period_end := nullif(p_subscription->>'current_period_end','')::bigint;
  end if;
  update public.memberships set
    status = case stripe_status
      when 'active' then 'active'::public.membership_status
      when 'past_due' then 'past_due'::public.membership_status
      when 'unpaid' then 'past_due'::public.membership_status
      when 'canceled' then 'cancelled'::public.membership_status
      else 'inactive'::public.membership_status
    end,
    ends_at = coalesce(to_timestamp(period_end), ends_at)
  where stripe_subscription_id = subscription_id;
  get diagnostics rows_changed = row_count;
  if rows_changed = 0 then raise exception 'CometX membership subscription not found'; end if;
end $$;
revoke all on function public.sync_cometx_membership_subscription(jsonb) from public, anon, authenticated;
grant execute on function public.sync_cometx_membership_subscription(jsonb) to service_role;

commit;
