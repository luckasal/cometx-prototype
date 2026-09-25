-- Orders are the source of truth for new event purchases. No ticket attendee is
-- created until a free order is issued or Stripe confirms payment.
begin;

create table public.ticket_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  user_id uuid references auth.users(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_kind text not null check (buyer_kind in ('member','guest')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  status text not null default 'pending' check (status in ('pending','processing','confirmed','free','failed','expired','cancelled','refunded','manual_review')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  expires_at timestamptz not null default now() + interval '90 minutes',
  guest_token_hash text,
  guest_token_ciphertext text,
  guest_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((buyer_kind = 'guest' and contact_id is not null and ((user_id is null and guest_token_hash is not null and guest_token_ciphertext is not null) or (user_id is not null and guest_token_hash is null and guest_token_ciphertext is null)))
    or (buyer_kind = 'member' and user_id is not null and guest_token_hash is null and guest_token_ciphertext is null))
);
create index ticket_orders_user_idx on public.ticket_orders(user_id, created_at desc);
create index ticket_orders_event_idx on public.ticket_orders(event_id, created_at desc);
alter table public.ticket_orders enable row level security;
revoke all on public.ticket_orders from public, anon, authenticated;
grant all on public.ticket_orders to service_role;

create table public.ticket_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ticket_orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id),
  ticket_name text not null,
  quantity integer not null check (quantity between 1 and 10),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  price_basis text not null check (price_basis in ('public','member','entitlement_free')),
  created_at timestamptz not null default now(),
  unique(order_id, ticket_type_id)
);
create index ticket_order_items_ticket_idx on public.ticket_order_items(ticket_type_id);
alter table public.ticket_order_items enable row level security;
revoke all on public.ticket_order_items from public, anon, authenticated;
grant all on public.ticket_order_items to service_role;

create table public.ticket_attendees (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ticket_orders(id),
  order_item_id uuid not null references public.ticket_order_items(id),
  event_id uuid not null references public.events(id),
  ticket_type_id uuid not null references public.ticket_types(id),
  user_id uuid references auth.users(id) on delete set null,
  attendee_name text not null,
  attendee_email text not null,
  ticket_code text not null unique default upper(replace(gen_random_uuid()::text, '-', '')),
  status text not null default 'valid' check(status in ('valid','checked_in','cancelled','refunded')),
  created_at timestamptz not null default now()
);
create index ticket_attendees_user_idx on public.ticket_attendees(user_id, created_at desc);
create index ticket_attendees_event_idx on public.ticket_attendees(event_id, created_at desc);
alter table public.ticket_attendees enable row level security;
revoke all on public.ticket_attendees from public, anon, authenticated;
grant all on public.ticket_attendees to service_role;

alter table public.payments
  add column order_id uuid references public.ticket_orders(id) on delete set null,
  add column contact_id uuid references public.contacts(id) on delete set null,
  add column guest_email text;
create index payments_order_idx on public.payments(order_id);

create or replace function public.begin_ticket_order(
  p_user_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_lines jsonb,
  p_payments_ready boolean,
  p_guest_token_hash text default null,
  p_guest_token_ciphertext text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  first_ticket uuid;
  event_row public.events;
  user_email text;
  buyer_name text;
  buyer_email text;
  contact uuid;
  plan_id uuid;
  benefits jsonb := '{}'::jsonb;
  order_id uuid;
  total_minor bigint := 0;
  item jsonb;
  ticket public.ticket_types;
  item_qty integer;
  unit_minor bigint;
  line_minor bigint;
  line_currency text;
  basis text;
  member_eligible boolean;
  free_by_entitlement boolean;
  attendee_ix integer;
  order_status text;
  expires timestamptz;
  item_row uuid;
  buyer_user uuid;
begin
  create temporary table if not exists ticket_order_quote (
    ticket_id uuid, ticket_name text, quantity integer, unit_minor bigint,
    line_minor bigint, currency text, basis text
  ) on commit drop;
  truncate table pg_temp.ticket_order_quote;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 10 then
    raise exception 'Choose between 1 and 10 ticket types';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lines) x where x->>'ticket_id' is null or (x->>'quantity') !~ '^\d+$') then
    raise exception 'Invalid ticket selection';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lines) x group by x->>'ticket_id' having count(*) > 1) then
    raise exception 'Duplicate ticket type';
  end if;
  if (select coalesce(sum((x->>'quantity')::integer),0) from jsonb_array_elements(p_lines) x) > 10 then
    raise exception 'Choose no more than 10 tickets per order';
  end if;
  first_ticket := (p_lines->0->>'ticket_id')::uuid;
  select e.* into event_row from public.events e join public.ticket_types t on t.event_id=e.id where t.id=first_ticket;
  if not found then raise exception 'Ticket unavailable'; end if;
  perform 1 from public.events where id=event_row.id for update;
  select * into event_row from public.events where id=event_row.id;

  buyer_user := p_user_id;
  if buyer_user is not null then
    select lower(u.email), nullif(trim(concat_ws(' ',p.first_name,p.last_name)), '')
      into user_email, buyer_name from auth.users u left join public.profiles p on p.id=u.id where u.id=buyer_user;
    if user_email is null then raise exception 'Please sign in again'; end if;
    buyer_email := user_email;
    buyer_name := coalesce(buyer_name, user_email);
    insert into public.contacts(email,first_name,last_name,source,newsletter_status,member_id)
      values(buyer_email,split_part(buyer_name,' ',1),case when position(' ' in buyer_name)>0 then substring(buyer_name from position(' ' in buyer_name)+1) end,'event_order','pending',buyer_user)
      on conflict(email) do update set
        member_id=coalesce(contacts.member_id,excluded.member_id),
        first_name=coalesce(nullif(contacts.first_name,''),excluded.first_name),
        last_name=coalesce(nullif(contacts.last_name,''),excluded.last_name),
        source=case when contacts.source='manual' then 'event_order' else contacts.source end,
        updated_at=now()
      where contacts.member_id is null or contacts.member_id=excluded.member_id
      returning id into contact;
  else
    buyer_email := lower(trim(coalesce(p_guest_email,'')));
    buyer_name := trim(coalesce(p_guest_name,''));
    if buyer_name = '' or length(buyer_name) > 240 or buyer_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Enter your name and a valid email address';
    end if;
    if coalesce(length(p_guest_token_hash),0) < 32 or coalesce(length(p_guest_token_ciphertext),0) < 32 then
      raise exception 'Secure guest ticket access is not configured';
    end if;
    insert into public.contacts(email,first_name,last_name,source,newsletter_status)
      values(buyer_email,split_part(buyer_name,' ',1),case when position(' ' in buyer_name)>0 then substring(buyer_name from position(' ' in buyer_name)+1) end,'event_order','pending')
      on conflict(email) do update set
        first_name=coalesce(nullif(contacts.first_name,''),excluded.first_name),
        last_name=coalesce(nullif(contacts.last_name,''),excluded.last_name),
        source=case when contacts.source='manual' then 'event_order' else contacts.source end,
        updated_at=now()
      returning id into contact;
  end if;

  if buyer_user is not null then
    select m.membership_plan_id into plan_id from public.memberships m
      where m.user_id=buyer_user and m.status='active' and m.starts_at<=now() and (m.ends_at is null or m.ends_at>now())
      order by m.starts_at desc limit 1 for share;
    select coalesce(jsonb_object_agg(en.key,pe.value),'{}'::jsonb) into benefits
      from public.plan_entitlements pe join public.entitlements en on en.id=pe.entitlement_id where pe.membership_plan_id=plan_id;
  end if;

  line_currency := null;
  for item in select value from jsonb_array_elements(p_lines) loop
    item_qty := (item->>'quantity')::integer;
    if item_qty < 1 or item_qty > 10 then raise exception 'Invalid ticket quantity'; end if;
    select * into ticket from public.ticket_types where id=(item->>'ticket_id')::uuid and event_id=event_row.id and active for share;
    if not found then raise exception 'One of the selected tickets is unavailable'; end if;
    if event_row.publish_state <> 'published' or event_row.event_status <> 'registration_open' or event_row.start_date <= now()
      or (event_row.registration_start is not null and event_row.registration_start > now())
      or (event_row.registration_end is not null and event_row.registration_end <= now())
      or (ticket.sale_start is not null and ticket.sale_start > now()) or (ticket.sale_end is not null and ticket.sale_end <= now()) then
      raise exception 'Ticket sales are closed';
    end if;
    if ticket.required_entitlement is not null and not (benefits ? ticket.required_entitlement) then
      raise exception 'This ticket type requires its listed CometX membership benefit';
    end if;
    member_eligible := buyer_user is not null and plan_id is not null;
    basis := 'public';
    unit_minor := round(ticket.base_price*100)::bigint;
    free_by_entitlement := member_eligible and ticket.free_entitlement is not null and benefits ? ticket.free_entitlement;
    if free_by_entitlement then
      unit_minor := 0; basis := 'entitlement_free';
    elsif member_eligible and ticket.member_price is not null then
      unit_minor := round(ticket.member_price*100)::bigint; basis := 'member';
    elsif member_eligible and ticket.discount_entitlement is not null and benefits ? ticket.discount_entitlement then
      unit_minor := round((ticket.base_price-round(ticket.base_price*least(100,greatest(0,coalesce((benefits->>ticket.discount_entitlement)::numeric,0)))/100,2))*100)::bigint;
      basis := 'member';
    end if;
    if line_currency is not null and line_currency <> upper(ticket.currency) then raise exception 'All ticket types in one order must use the same currency'; end if;
    line_currency := upper(ticket.currency);
    line_minor := unit_minor*item_qty;
    if ticket.capacity is not null and (
      (select count(*) from public.ticket_attendees a where a.ticket_type_id=ticket.id and a.status in ('valid','checked_in'))
      + (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders o on o.id=oi.order_id where oi.ticket_type_id=ticket.id and o.status in ('pending','processing') and o.expires_at>now())
      + (select count(*) from public.registrations r where r.ticket_type_id=ticket.id and r.status in ('pending','confirmed','checked_in'))
      + item_qty > ticket.capacity) then raise exception 'Not enough tickets of one selected type remain'; end if;
    total_minor := total_minor+line_minor;
    insert into pg_temp.ticket_order_quote(ticket_id,ticket_name,quantity,unit_minor,line_minor,currency,basis)
      values(ticket.id,ticket.name,item_qty,unit_minor,line_minor,upper(ticket.currency),basis);
  end loop;

  if line_currency not in ('CHF','EUR','USD','GBP','CZK') then raise exception 'Unsupported ticket currency'; end if;
  if event_row.capacity is not null and (
    (select count(*) from public.ticket_attendees a where a.event_id=event_row.id and a.status in ('valid','checked_in'))
    + (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders o on o.id=oi.order_id where o.event_id=event_row.id and o.status in ('pending','processing') and o.expires_at>now())
    + (select count(*) from public.registrations r where r.event_id=event_row.id and r.status in ('pending','confirmed','checked_in'))
    + (select coalesce(sum((x->>'quantity')::integer),0) from jsonb_array_elements(p_lines) x) > event_row.capacity) then
    raise exception 'Not enough places remain for this order';
  end if;
  if total_minor > 0 and not p_payments_ready then raise exception 'Online payment setup is not complete'; end if;

  order_status := case when total_minor=0 then 'free' else 'pending' end;
  expires := now()+interval '90 minutes';
  insert into public.ticket_orders(event_id,user_id,contact_id,buyer_name,buyer_email,buyer_kind,amount_minor,currency,status,expires_at,guest_token_hash,guest_token_ciphertext)
    values(event_row.id,buyer_user,contact,buyer_name,buyer_email,case when buyer_user is null then 'guest' else 'member' end,total_minor,line_currency,order_status,expires,
      case when buyer_user is null then p_guest_token_hash end,case when buyer_user is null then p_guest_token_ciphertext end)
    returning id into order_id;
  for item in select to_jsonb(q.*) from pg_temp.ticket_order_quote q loop
    insert into public.ticket_order_items(order_id,ticket_type_id,ticket_name,quantity,unit_amount_minor,amount_minor,currency,price_basis)
      values(order_id,(item->>'ticket_id')::uuid,item->>'ticket_name',(item->>'quantity')::integer,(item->>'unit_minor')::bigint,(item->>'line_minor')::bigint,item->>'currency',item->>'basis') returning id into item_row;
    if total_minor=0 then
      for attendee_ix in 1..(item->>'quantity')::integer loop
        insert into public.ticket_attendees(order_id,order_item_id,event_id,ticket_type_id,user_id,attendee_name,attendee_email)
          values(order_id,item_row,event_row.id,(item->>'ticket_id')::uuid,buyer_user,buyer_name,buyer_email);
      end loop;
    end if;
  end loop;
  return jsonb_build_object('id',order_id,'event_id',event_row.id,'amount_minor',total_minor,'currency',line_currency,'status',order_status,'expires_at',expires);
exception when undefined_table then
  raise exception 'Ticket order schema is not initialized';
end $$;

-- Quote rows are scoped to one database transaction. The public RPC is service-only.
revoke all on function public.begin_ticket_order(uuid,text,text,jsonb,boolean,text,text) from public,anon,authenticated;
grant execute on function public.begin_ticket_order(uuid,text,text,jsonb,boolean,text,text) to service_role;

create or replace function public.apply_ticket_order_event(p_type text,p_session jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare o public.ticket_orders; event_id uuid; item record; n integer; amount_paid numeric;
begin
  if p_session->>'livemode' is distinct from 'false' then raise exception 'Test mode required'; end if;
  if coalesce(p_session->'metadata'->>'order_id','') = '' then raise exception 'Order metadata required'; end if;
  select * into o from public.ticket_orders where id=(p_session->'metadata'->>'order_id')::uuid;
  if not found then raise exception 'Unknown order'; end if;
  perform 1 from public.events where id=o.event_id for update;
  select * into o from public.ticket_orders where id=o.id for update;
  if p_session->>'id' is null or (o.stripe_checkout_session_id is not null and o.stripe_checkout_session_id<>p_session->>'id')
    or (p_session->>'amount_total')::bigint is distinct from o.amount_minor
    or lower(p_session->>'currency') is distinct from lower(o.currency) then raise exception 'Checkout session does not match order'; end if;
  if o.status in ('confirmed','free','refunded','cancelled','manual_review') then return; end if;
  if p_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and p_session->>'payment_status'='paid' then
    if o.status in ('failed','expired') or o.expires_at <= now() then
      update public.ticket_orders set status='manual_review',stripe_checkout_session_id=p_session->>'id',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=o.id;
      insert into public.payments(user_id,order_id,contact_id,guest_email,stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,amount,currency,status)
        values(o.user_id,o.id,o.contact_id,case when o.user_id is null then o.buyer_email end,p_session->>'customer',p_session->>'id',p_session->>'payment_intent',o.amount_minor/100.0,o.currency,'paid')
        on conflict(stripe_checkout_session_id) do update set order_id=excluded.order_id,stripe_customer_id=excluded.stripe_customer_id,status='paid',updated_at=now();
      return;
    end if;
    if o.event_id is not null and (select capacity from public.events where id=o.event_id) is not null and
      (select count(*) from public.ticket_attendees a where a.event_id=o.event_id and a.status in ('valid','checked_in'))
      + (select count(*) from public.registrations r where r.event_id=o.event_id and r.status in ('pending','confirmed','checked_in'))
      + (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders other_order on other_order.id=oi.order_id where other_order.event_id=o.event_id and other_order.status in ('pending','processing') and other_order.expires_at>now() and other_order.id<>o.id)
      + (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi where oi.order_id=o.id) > (select capacity from public.events where id=o.event_id) then
      update public.ticket_orders set status='manual_review',stripe_checkout_session_id=p_session->>'id',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=o.id;
      insert into public.payments(user_id,order_id,contact_id,guest_email,stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,amount,currency,status)
        values(o.user_id,o.id,o.contact_id,case when o.user_id is null then o.buyer_email end,p_session->>'customer',p_session->>'id',p_session->>'payment_intent',o.amount_minor/100.0,o.currency,'paid')
        on conflict(stripe_checkout_session_id) do update set order_id=excluded.order_id,stripe_customer_id=excluded.stripe_customer_id,status='paid',updated_at=now();
      return;
    end if;
    for item in select * from public.ticket_order_items where order_id=o.id loop
      if (select t.capacity from public.ticket_types t where t.id=item.ticket_type_id) is not null and
        (select count(*) from public.ticket_attendees a where a.ticket_type_id=item.ticket_type_id and a.status in ('valid','checked_in'))
        + (select count(*) from public.registrations r where r.ticket_type_id=item.ticket_type_id and r.status in ('pending','confirmed','checked_in'))
        + (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders other_order on other_order.id=oi.order_id where oi.ticket_type_id=item.ticket_type_id and other_order.status in ('pending','processing') and other_order.expires_at>now() and other_order.id<>o.id)
        + item.quantity >
        (select t.capacity from public.ticket_types t where t.id=item.ticket_type_id) then
        update public.ticket_orders set status='manual_review',stripe_checkout_session_id=p_session->>'id',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=o.id;
        insert into public.payments(user_id,order_id,contact_id,guest_email,stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,amount,currency,status)
          values(o.user_id,o.id,o.contact_id,case when o.user_id is null then o.buyer_email end,p_session->>'customer',p_session->>'id',p_session->>'payment_intent',o.amount_minor/100.0,o.currency,'paid')
          on conflict(stripe_checkout_session_id) do update set order_id=excluded.order_id,stripe_customer_id=excluded.stripe_customer_id,status='paid',updated_at=now();
        return;
      end if;
      for n in 1..item.quantity loop
        insert into public.ticket_attendees(order_id,order_item_id,event_id,ticket_type_id,user_id,attendee_name,attendee_email)
          values(o.id,item.id,o.event_id,item.ticket_type_id,o.user_id,o.buyer_name,o.buyer_email);
      end loop;
    end loop;
    update public.ticket_orders set status='confirmed',stripe_checkout_session_id=p_session->>'id',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=o.id;
    amount_paid:=o.amount_minor/100.0;
    insert into public.payments(user_id,order_id,contact_id,guest_email,stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,amount,currency,status)
      values(o.user_id,o.id,o.contact_id,case when o.user_id is null then o.buyer_email end,p_session->>'customer',p_session->>'id',p_session->>'payment_intent',amount_paid,o.currency,'paid')
      on conflict(stripe_checkout_session_id) do update set order_id=excluded.order_id,stripe_customer_id=excluded.stripe_customer_id,stripe_payment_intent_id=excluded.stripe_payment_intent_id,amount=excluded.amount,status='paid',updated_at=now();
  elsif p_type='checkout.session.completed' then
    update public.ticket_orders set status='processing',stripe_checkout_session_id=p_session->>'id',updated_at=now() where id=o.id and status='pending';
    insert into public.payments(user_id,order_id,contact_id,guest_email,stripe_customer_id,stripe_checkout_session_id,amount,currency,status)
      values(o.user_id,o.id,o.contact_id,case when o.user_id is null then o.buyer_email end,p_session->>'customer',p_session->>'id',o.amount_minor/100.0,o.currency,'pending')
      on conflict(stripe_checkout_session_id) do nothing;
  elsif p_type in ('checkout.session.expired','checkout.session.async_payment_failed') then
    update public.ticket_orders set status=case when p_type='checkout.session.expired' then 'expired' else 'failed' end,updated_at=now() where id=o.id;
    update public.payments set status=case when p_type='checkout.session.expired' then 'void'::public.payment_status else 'failed'::public.payment_status end,updated_at=now() where order_id=o.id;
  end if;
end $$;
revoke all on function public.apply_ticket_order_event(text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_ticket_order_event(text,jsonb) to service_role;

create or replace function public.save_ticket_checkout_session(p_order_id uuid,p_session_id text)
returns void language plpgsql security definer set search_path=public as $$
declare o public.ticket_orders;
begin
  update public.ticket_orders set stripe_checkout_session_id=p_session_id,updated_at=now()
   where id=p_order_id and status='pending' and stripe_checkout_session_id is null returning * into o;
  if not found then
    if exists(select 1 from public.ticket_orders where id=p_order_id and stripe_checkout_session_id=p_session_id) then return; end if;
    raise exception 'Order can no longer be checked out';
  end if;
  insert into public.payments(user_id,order_id,contact_id,guest_email,stripe_checkout_session_id,amount,currency,status)
   values(o.user_id,o.id,o.contact_id,case when o.user_id is null then o.buyer_email end,p_session_id,o.amount_minor/100.0,o.currency,'pending')
   on conflict(stripe_checkout_session_id) do nothing;
end $$;
revoke all on function public.save_ticket_checkout_session(uuid,text) from public,anon,authenticated;
grant execute on function public.save_ticket_checkout_session(uuid,text) to service_role;

create or replace function public.fail_unstarted_ticket_order(p_order_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.ticket_orders set status='failed',updated_at=now() where id=p_order_id and status='pending' and stripe_checkout_session_id is null
$$;
revoke all on function public.fail_unstarted_ticket_order(uuid) from public,anon,authenticated;
grant execute on function public.fail_unstarted_ticket_order(uuid) to service_role;

create or replace function public.claim_guest_ticket_order(p_order_id uuid,p_token_hash text,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare o public.ticket_orders; user_email text;
begin
  select * into o from public.ticket_orders where id=p_order_id for update;
  if not found or o.user_id is not null or o.guest_token_hash is distinct from p_token_hash then return false; end if;
  select lower(email) into user_email from auth.users where id=p_user_id;
  if user_email is null or user_email<>lower(o.buyer_email) then return false; end if;
  -- Keep buyer_kind as the immutable purchase-time distinction for staff reporting.
  update public.ticket_orders set user_id=p_user_id,guest_token_hash=null,guest_token_ciphertext=null,updated_at=now() where id=o.id;
  update public.ticket_attendees set user_id=p_user_id where order_id=o.id;
  update public.contacts set member_id=p_user_id,updated_at=now() where id=o.contact_id and (member_id is null or member_id=p_user_id);
  return true;
end $$;
revoke all on function public.claim_guest_ticket_order(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_guest_ticket_order(uuid,text,uuid) to service_role;

commit;
