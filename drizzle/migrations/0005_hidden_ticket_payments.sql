-- Apply after 0004. Existing reservations are retained. Sandbox checkout only.
begin;
alter table public.ticket_types
 add column member_price numeric(10,2) check(member_price >= 0 and member_price <= base_price),
 add column sale_start timestamptz,
 add column sale_end timestamptz,
 add constraint ticket_sale_dates check(sale_end is null or sale_start is null or sale_end > sale_start);
alter table public.registrations add column if not exists quoted_price numeric(10,2) not null default 0;

-- Provider mappings are never returned through public event/admin content queries.
create table public.ticket_payment_prices (
 ticket_id uuid not null references public.ticket_types(id),
 amount_minor bigint not null check(amount_minor > 0),
 currency text not null,
 product_id text not null,
 price_id text not null unique,
 primary key(ticket_id, amount_minor, currency)
);
alter table public.ticket_payment_prices enable row level security;
revoke all on public.ticket_payment_prices from public,anon,authenticated;
grant all on public.ticket_payment_prices to service_role;
create table public.ticket_payment_products (
 ticket_id uuid primary key references public.ticket_types(id),
 product_id text not null unique
);
alter table public.ticket_payment_products enable row level security;
revoke all on public.ticket_payment_products from public,anon,authenticated;
grant all on public.ticket_payment_products to service_role;

create table public.ticket_checkouts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 event_id uuid not null references public.events(id),
 ticket_id uuid not null references public.ticket_types(id),
 quantity integer not null check(quantity between 1 and 10),
 amount_minor bigint not null check(amount_minor >= 0),
 currency text not null,
 session_id text unique,
 session_url text,
 expires_at timestamptz not null default now()+interval '90 minutes',
 status text not null default 'pending' check(status in ('pending','processing','paid','expired','failed','free'))
);
alter table public.ticket_checkouts enable row level security;
revoke all on public.ticket_checkouts from public,anon,authenticated;
grant all on public.ticket_checkouts to service_role;
create table public.ticket_checkout_items (
 checkout_id uuid not null references public.ticket_checkouts(id),
 registration_id uuid not null unique references public.registrations(id),
 primary key(checkout_id,registration_id)
);
alter table public.ticket_checkout_items enable row level security;
revoke all on public.ticket_checkout_items from public,anon,authenticated;
grant all on public.ticket_checkout_items to service_role;

-- A buyer may purchase multiple places for an event.
drop index public.registrations_unique_active;
create unique index ticket_checkouts_one_open_order on public.ticket_checkouts(event_id,user_id)
 where status in ('pending','processing');

-- Only the authenticated server calls this. Event lock serializes every seat allocation.
create function public.begin_ticket_checkout(p_user_id uuid,p_ticket_id uuid,p_quantity integer,p_payments_ready boolean default false)
returns public.ticket_checkouts language plpgsql security definer set search_path=public as $$
declare t public.ticket_types; e public.events; r public.registrations; c public.ticket_checkouts; i integer; target_event uuid;
 benefits jsonb; plan_id uuid; amount numeric;
begin
 select event_id into target_event from public.ticket_types where id=p_ticket_id;
 select * into e from public.events where id=target_event for update;
 select * into t from public.ticket_types where id=p_ticket_id and active for share;
 if t.id is null or e.id is null then raise exception 'Ticket unavailable'; end if;
 if p_quantity<1 or p_quantity>10 then raise exception 'Choose between 1 and 10 tickets'; end if;
 if e.publish_state <> 'published' or e.event_status <> 'registration_open' or e.start_date <= now()
 or (e.registration_start is not null and e.registration_start>now())
 or (e.registration_end is not null and e.registration_end<=now())
 or (t.sale_start is not null and t.sale_start>now())
 or (t.sale_end is not null and t.sale_end<=now()) then raise exception 'Ticket sales are closed'; end if;
 update public.ticket_checkouts set status='expired'
 where event_id=e.id and user_id=p_user_id and status='pending' and expires_at<=now();
 update public.registrations set status='cancelled'
 where id in(select ci.registration_id from public.ticket_checkout_items ci
   join public.ticket_checkouts tc on tc.id=ci.checkout_id
   where tc.event_id=e.id and tc.user_id=p_user_id and tc.status='expired')
   and status='pending';
 select * into c from public.ticket_checkouts where event_id=e.id and user_id=p_user_id
 and status in ('pending','processing') and expires_at>now() for update;
 if found then
   if c.ticket_id=t.id and c.quantity=p_quantity then return c; end if;
   raise exception 'Finish or cancel your existing checkout before starting another';
 end if;
 select membership_plan_id into plan_id from public.memberships where user_id=p_user_id and status='active'
 and starts_at<=now() and (ends_at is null or ends_at>now()) order by starts_at desc limit 1;
 select coalesce(jsonb_object_agg(en.key,pe.value),'{}'::jsonb) into benefits from public.plan_entitlements pe
 join public.entitlements en on en.id=pe.entitlement_id where pe.membership_plan_id=plan_id;
 if t.required_entitlement is not null and not(benefits ? t.required_entitlement) then raise exception 'Membership benefit required'; end if;
 amount:=t.base_price;
 if plan_id is not null and t.member_price is not null then amount:=t.member_price;
 elsif t.free_entitlement is not null and benefits ? t.free_entitlement then amount:=0;
 elsif t.discount_entitlement is not null and benefits ? t.discount_entitlement then
 amount:=t.base_price-round(t.base_price*least(100,greatest(0,coalesce((benefits->>t.discount_entitlement)::numeric,0)))/100,2);
 end if;
 if upper(t.currency) not in ('CHF','EUR','USD','GBP','CZK') then raise exception 'Unsupported currency'; end if;
 if amount>0 and not p_payments_ready then raise exception 'Online payment setup is not complete. Please contact CometX'; end if;
 if e.capacity is not null and (select count(*) from public.registrations where event_id=e.id and status in('pending','confirmed','checked_in'))+p_quantity>e.capacity then raise exception 'Not enough places remain'; end if;
 if t.capacity is not null and (select count(*) from public.registrations where ticket_type_id=t.id and status in('pending','confirmed','checked_in'))+p_quantity>t.capacity then raise exception 'Not enough tickets of this type remain'; end if;
 insert into public.ticket_checkouts(user_id,event_id,ticket_id,quantity,amount_minor,currency,status)
 values(p_user_id,e.id,t.id,p_quantity,round(amount*100)::bigint*p_quantity,lower(t.currency),case when amount=0 then 'free' else 'pending' end) returning * into c;
 for i in 1..p_quantity loop
   insert into public.registrations(event_id,user_id,ticket_type_id,status,price_paid,quoted_price,currency)
   values(e.id,p_user_id,t.id,case when amount=0 then 'confirmed'::public.registration_status else 'pending'::public.registration_status end,
   case when amount=0 then 0 else 0 end,amount,upper(t.currency)) returning * into r;
   insert into public.ticket_checkout_items(checkout_id,registration_id) values(c.id,r.id);
 end loop;
 return c;
end $$;
revoke all on function public.begin_ticket_checkout(uuid,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.begin_ticket_checkout(uuid,uuid,integer,boolean) to service_role;

-- Release a hold only when no Checkout Session was created. This is used when
-- product/price setup fails before the request reaches Stripe Checkout.
create function public.release_unstarted_ticket_checkout(p_checkout_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.ticket_checkouts set status='failed'
 where id=p_checkout_id and status='pending' and session_id is null;
 if found then
   update public.registrations set status='cancelled'
   where id in(select registration_id from public.ticket_checkout_items where checkout_id=p_checkout_id)
     and status='pending';
 end if;
end $$;
revoke all on function public.release_unstarted_ticket_checkout(uuid) from public,anon,authenticated;
grant execute on function public.release_unstarted_ticket_checkout(uuid) to service_role;

-- Prevent older browser bundles from confirming paid tickets without payment.
create or replace function public.register_prototype_ticket(p_ticket_type_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
begin raise exception 'Please refresh the page to use the current checkout'; end $$;
create or replace function public.reserve_free_ticket(p_ticket_type_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
begin raise exception 'Please refresh the page to use the current checkout'; end $$;

-- Replace the old ledger trigger: a session ID alone does NOT mean paid.
create or replace function public.record_registration_payment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.stripe_checkout_session_id is not null then
 insert into public.payments(user_id,registration_id,stripe_checkout_session_id,stripe_payment_intent_id,amount,currency,status)
 values(new.user_id,new.id,new.stripe_checkout_session_id,new.stripe_payment_intent_id,
 case when new.status in ('confirmed','checked_in') then new.price_paid else new.quoted_price end,new.currency,
 case when new.status in ('confirmed','checked_in') then 'paid'::public.payment_status else 'pending'::public.payment_status end)
 on conflict(stripe_checkout_session_id) do update set amount=excluded.amount,status=excluded.status,
 stripe_payment_intent_id=excluded.stripe_payment_intent_id;
 end if;
 return new;
end $$;

create function public.apply_ticket_checkout_event(p_type text,p_session jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare c public.ticket_checkouts; eid uuid;
begin
 if p_session->>'livemode' is distinct from 'false' then raise exception 'Test mode required'; end if;
 select event_id into eid from public.ticket_checkouts where id=(p_session->'metadata'->>'checkout_id')::uuid;
 perform 1 from public.events where id=eid for update;
 select * into c from public.ticket_checkouts where id=(p_session->'metadata'->>'checkout_id')::uuid for update;
 if not found then raise exception 'Unknown checkout'; end if;
 if c.session_id is not null and c.session_id is distinct from p_session->>'id' then raise exception 'Session mismatch'; end if;
 if p_session->>'id' is null or (p_session->>'amount_total')::bigint is distinct from c.amount_minor
 or p_session->>'currency' is distinct from c.currency
 or p_session->'metadata'->>'user_id' is distinct from c.user_id::text then raise exception 'Checkout mismatch'; end if;
 if c.status in ('paid','free') then return; end if;
 if p_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and p_session->>'payment_status'='paid' then
   if c.status in ('expired','failed') then raise exception 'Payment after released hold requires review'; end if;
   update public.ticket_checkouts set status='paid',session_id=p_session->>'id' where id=c.id;
   update public.registrations set status='confirmed',price_paid=quoted_price,
   stripe_checkout_session_id=p_session->>'id',stripe_payment_intent_id=p_session->>'payment_intent'
   where id in(select registration_id from public.ticket_checkout_items where checkout_id=c.id);
   insert into public.payments(user_id,stripe_checkout_session_id,stripe_payment_intent_id,amount,currency,status)
   values(c.user_id,p_session->>'id',p_session->>'payment_intent',c.amount_minor/100.0,upper(c.currency),'paid')
   on conflict(stripe_checkout_session_id) do update set amount=excluded.amount,status='paid',stripe_payment_intent_id=excluded.stripe_payment_intent_id;
 elsif p_type='checkout.session.completed' then
   if c.status='pending' then update public.ticket_checkouts set status='processing',session_id=p_session->>'id' where id=c.id; end if;
 elsif p_type in ('checkout.session.expired','checkout.session.async_payment_failed') then
   update public.ticket_checkouts set status=case when p_type='checkout.session.expired' then 'expired' else 'failed' end where id=c.id;
   update public.registrations set status='cancelled' where id in(select registration_id from public.ticket_checkout_items where checkout_id=c.id);
   update public.payments set status=case when p_type='checkout.session.expired' then 'void'::public.payment_status else 'failed'::public.payment_status end where stripe_checkout_session_id=c.session_id;
 end if;
end $$;
drop trigger if exists registrations_record_payment on public.registrations;
revoke all on function public.apply_ticket_checkout_event(text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_ticket_checkout_event(text,jsonb) to service_role;
commit;
