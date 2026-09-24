-- Apply after 0000 and 0001. This migration adds no demo users and deletes no data.
begin;

-- Serialize seat allocation at the event row, including writes through service_role.
create or replace function public.guard_registration_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare event_limit integer; ticket_limit integer; ticket_event uuid;
begin
  if new.status not in ('pending','confirmed','checked_in') then return new; end if;
  select capacity into event_limit from public.events where id = new.event_id for update;
  if not found then raise exception 'Event not found'; end if;
  select event_id, capacity into ticket_event, ticket_limit from public.ticket_types where id = new.ticket_type_id;
  if not found or ticket_event <> new.event_id then raise exception 'Ticket does not belong to this event'; end if;
  if event_limit is not null and (select count(*) from public.registrations where event_id = new.event_id and status in ('pending','confirmed','checked_in') and id <> new.id) >= event_limit then
    raise exception 'This event is sold out';
  end if;
  if ticket_limit is not null and (select count(*) from public.registrations where ticket_type_id = new.ticket_type_id and status in ('pending','confirmed','checked_in') and id <> new.id) >= ticket_limit then
    raise exception 'This ticket is sold out';
  end if;
  return new;
end $$;
create trigger registrations_capacity_guard before insert or update of status, event_id, ticket_type_id on public.registrations
for each row execute function public.guard_registration_capacity();

create or replace function public.reserve_free_ticket(p_ticket_type_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid(); t public.ticket_types; e public.events; result_id uuid;
  benefits jsonb := '{}'::jsonb; final_price numeric; discount_value numeric := 0;
begin
  if u is null then raise exception 'Sign in to reserve a place'; end if;
  select * into t from public.ticket_types where id = p_ticket_type_id and active;
  if not found then raise exception 'Ticket not available'; end if;
  select * into e from public.events where id = t.event_id for update;
  if e.status <> 'registration_open' or (e.registration_start is not null and e.registration_start > now()) or (e.registration_end is not null and e.registration_end < now()) then
    raise exception 'Registration is closed';
  end if;
  select coalesce(jsonb_object_agg(en.key, pe.value), '{}'::jsonb) into benefits
  from public.plan_entitlements pe join public.entitlements en on en.id = pe.entitlement_id
  where pe.membership_plan_id = (
    select m.membership_plan_id from public.memberships m where m.user_id = u and m.status = 'active'
      and m.starts_at <= now() and (m.ends_at is null or m.ends_at > now()) order by m.starts_at desc limit 1
  );
  if t.required_entitlement is not null and not (benefits ? t.required_entitlement) then raise exception 'Membership benefit required'; end if;
  final_price := t.base_price;
  if t.free_entitlement is not null and benefits ? t.free_entitlement then final_price := 0;
  elsif t.discount_entitlement is not null then
    discount_value := least(100, greatest(0, coalesce((benefits->>t.discount_entitlement)::numeric,0)));
    final_price := t.base_price - round(t.base_price * discount_value / 100,2);
  end if;
  if final_price <> 0 then raise exception 'Payment required'; end if;
  insert into public.registrations(event_id,user_id,ticket_type_id,status,price_paid,currency)
  values(e.id,u,t.id,'confirmed',0,t.currency) returning id into result_id;
  return result_id;
exception when unique_violation then raise exception 'You are already registered for this event';
end $$;
revoke all on function public.reserve_free_ticket(uuid) from public, anon;
grant execute on function public.reserve_free_ticket(uuid) to authenticated;

create table public.stripe_checkout_receipts (
  session_id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.stripe_checkout_receipts enable row level security;
revoke all on public.stripe_checkout_receipts from anon, authenticated;
grant all on public.stripe_checkout_receipts to service_role;

-- Receipt and entitlement changes commit together; retries cannot extend a membership.
create or replace function public.fulfill_cometx_checkout(p_session jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := p_session->'metadata'; u uuid; eid uuid; tid uuid; pid uuid;
  amount numeric; curr text; added integer;
begin
  if p_session->>'payment_status' is distinct from 'paid' or p_session->>'livemode' is distinct from 'false' then raise exception 'Paid test session required'; end if;
  if coalesce(p_session->>'id','') = '' then raise exception 'Missing checkout session'; end if;
  if (meta->>'expected_amount') is null or (p_session->>'amount_total')::bigint <> (meta->>'expected_amount')::bigint
     or lower(p_session->>'currency') is distinct from lower(meta->>'expected_currency') then raise exception 'Checkout amount mismatch'; end if;
  insert into public.stripe_checkout_receipts(session_id) values(p_session->>'id') on conflict do nothing;
  get diagnostics added = row_count;
  if added = 0 then return; end if;
  u := (meta->>'user_id')::uuid;
  perform 1 from auth.users where id = u for update;
  if not found then raise exception 'User not found'; end if;
  amount := (p_session->>'amount_total')::numeric / 100;
  curr := upper(p_session->>'currency');
  if meta->>'kind' = 'event_ticket' then
    eid := (meta->>'event_id')::uuid; tid := (meta->>'ticket_type_id')::uuid;
    perform 1 from public.ticket_types where id=tid and event_id=eid and upper(currency)=curr;
    if not found then raise exception 'Ticket metadata mismatch'; end if;
    perform 1 from public.events where id=eid and status <> 'cancelled' for update;
    if not found then raise exception 'Event is cancelled'; end if;
    insert into public.registrations(event_id,user_id,ticket_type_id,status,price_paid,currency,stripe_checkout_session_id,stripe_payment_intent_id)
    values(eid,u,tid,'confirmed',amount,curr,p_session->>'id',p_session->>'payment_intent');
  elsif meta->>'kind' = 'membership' then
    pid := (meta->>'membership_plan_id')::uuid;
    perform 1 from public.membership_plans where id=pid and upper(currency)=curr;
    if not found then raise exception 'Membership metadata mismatch'; end if;
    update public.memberships set status='inactive' where user_id=u and status in ('active','past_due');
    insert into public.memberships(user_id,membership_plan_id,status,starts_at,ends_at,stripe_customer_id,stripe_subscription_id)
    values(u,pid,'active',now(),now()+interval '1 year',p_session->>'customer',p_session->>'subscription');
  else raise exception 'Unknown checkout kind'; end if;
end $$;
revoke all on function public.fulfill_cometx_checkout(jsonb) from public, anon, authenticated;
grant execute on function public.fulfill_cometx_checkout(jsonb) to service_role;

commit;
