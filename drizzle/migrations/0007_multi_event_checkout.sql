begin;

create table public.ticket_checkout_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  buyer_name text not null, buyer_email text not null,
  buyer_kind text not null check (buyer_kind in ('member','guest')),
  amount_minor bigint not null check (amount_minor >= 0), currency text not null,
  status text not null check (status in ('pending','processing','confirmed','free','failed','expired','manual_review')),
  order_ids uuid[] not null, stripe_checkout_session_id text unique, stripe_payment_intent_id text unique,
  guest_token_hash text, guest_token_ciphertext text, guest_email_sent_at timestamptz, expires_at timestamptz not null,
  terms_accepted_at timestamptz not null, terms_url text not null, privacy_url text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((buyer_kind='guest' and user_id is null and guest_token_hash is not null and guest_token_ciphertext is not null)
    or (buyer_kind='member' and user_id is not null and guest_token_hash is null and guest_token_ciphertext is null))
);
alter table public.ticket_checkout_batches enable row level security;
revoke all on public.ticket_checkout_batches from public,anon,authenticated;
grant all on public.ticket_checkout_batches to service_role;
alter table public.ticket_orders add column checkout_batch_id uuid references public.ticket_checkout_batches(id);
create index ticket_orders_batch_idx on public.ticket_orders(checkout_batch_id);
alter table public.ticket_order_items add column attendee_names text[] not null default '{}';
alter table public.payments add column checkout_batch_id uuid references public.ticket_checkout_batches(id) on delete set null;

create or replace function public.begin_ticket_checkout_batch(
  p_user_id uuid,p_guest_name text,p_guest_email text,p_events jsonb,p_terms_accepted boolean,p_payments_ready boolean,
  p_guest_token_hash text default null,p_guest_token_ciphertext text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare ev jsonb; ln jsonb; payload jsonb; created jsonb; order_ids uuid[] := '{}'; v_order_id uuid;
  total bigint := 0; currency_code text; batch_id uuid; batch_status text; expiry timestamptz;
  full_name text; expected_qty integer; ix integer;
begin
  if p_terms_accepted is distinct from true then raise exception 'Accept the CometX terms to continue'; end if;
  if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)<1 or jsonb_array_length(p_events)>10 then raise exception 'Choose between 1 and 10 events'; end if;
  if (select count(distinct x->>'eventSlug') from jsonb_array_elements(p_events) x)<>jsonb_array_length(p_events) then raise exception 'Each event must be listed once'; end if;
  if exists(select 1 from jsonb_array_elements(p_events) e where jsonb_typeof(e->'lines')<>'array' or jsonb_array_length(e->'lines')<1) then raise exception 'Each selected event needs tickets'; end if;
  for ev in select value from jsonb_array_elements(p_events) order by value->>'eventSlug' loop
    if (select coalesce(sum((x->>'quantity')::integer),0) from jsonb_array_elements(ev->'lines') x)>10 then raise exception 'Choose no more than 10 tickets per event'; end if;
    for ln in select value from jsonb_array_elements(ev->'lines') loop
      expected_qty := (ln->>'quantity')::integer;
      if expected_qty<1 or jsonb_typeof(ln->'attendees')<>'array' or jsonb_array_length(ln->'attendees')<>expected_qty then raise exception 'Add attendee details for every ticket'; end if;
      for ix in 0..expected_qty-1 loop
        full_name := trim(coalesce(ln->'attendees'->ix->>'firstName','')||' '||coalesce(ln->'attendees'->ix->>'lastName',''));
        if full_name='' or length(full_name)>241 then raise exception 'Enter each attendee name'; end if;
      end loop;
    end loop;
    if exists(select 1 from jsonb_array_elements(ev->'lines') x
      join public.ticket_types t on t.id=(x->>'ticketId')::uuid
      join public.events e on e.id=t.event_id
      where e.slug is distinct from ev->>'eventSlug') then raise exception 'Ticket does not match its event'; end if;
    payload := (select jsonb_agg(jsonb_build_object('ticket_id',x->>'ticketId','quantity',x->'quantity')) from jsonb_array_elements(ev->'lines') x);
    created := public.begin_ticket_order(p_user_id,p_guest_name,p_guest_email,payload,p_payments_ready,p_guest_token_hash,p_guest_token_ciphertext);
    v_order_id := (created->>'id')::uuid; order_ids := array_append(order_ids,v_order_id); total := total+(created->>'amount_minor')::bigint;
    if currency_code is not null and currency_code<>upper(created->>'currency') then raise exception 'Tickets in one checkout must use the same currency'; end if;
    currency_code := upper(created->>'currency');
    update public.ticket_order_items oi set attendee_names=(select array_agg(trim(coalesce(a->>'firstName','')||' '||coalesce(a->>'lastName','')) order by ord)
      from jsonb_array_elements(x->'attendees') with ordinality as at(a,ord))
      from jsonb_array_elements(ev->'lines') x where oi.order_id=v_order_id and oi.ticket_type_id=(x->>'ticketId')::uuid;
    update public.ticket_attendees a set attendee_name=entry.attendee_name from (
      select a2.id,oi.attendee_names[row_number() over(partition by a2.order_item_id order by a2.created_at,a2.id)] as attendee_name
      from public.ticket_attendees a2 join public.ticket_order_items oi on oi.id=a2.order_item_id where a2.order_id=v_order_id
    ) entry where a.id=entry.id;
  end loop;
  if total>0 and not p_payments_ready then raise exception 'Online payment setup is not complete'; end if;
  if total>0 then
    delete from public.ticket_attendees where order_id=any(order_ids);
    update public.ticket_orders set status='pending' where id=any(order_ids) and status='free';
  end if;
  select min(expires_at) into expiry from public.ticket_orders where id=any(order_ids);
  batch_status := case when total=0 then 'free' else 'pending' end;
  insert into public.ticket_checkout_batches(user_id,buyer_name,buyer_email,buyer_kind,amount_minor,currency,status,order_ids,guest_token_hash,guest_token_ciphertext,expires_at,terms_accepted_at,terms_url,privacy_url)
    select p_user_id,buyer_name,buyer_email,buyer_kind,total,currency_code,batch_status,order_ids,
      case when p_user_id is null then p_guest_token_hash end,case when p_user_id is null then p_guest_token_ciphertext end,expiry,now(),
      'https://www.cometx.ch/_files/ugd/41f758_b4416cc4324a440fae43acc5bf10defd.pdf',
      'https://www.cometx.ch/_files/ugd/41f758_cf8654296bfe4790be7ac44abfe07fbd.pdf'
      from public.ticket_orders where id=order_ids[1] returning id into batch_id;
  update public.ticket_orders set checkout_batch_id=batch_id where id=any(order_ids);
  return jsonb_build_object('id',batch_id,'order_ids',to_jsonb(order_ids),'amount_minor',total,'currency',currency_code,'status',batch_status,'expires_at',expiry);
end $$;
revoke all on function public.begin_ticket_checkout_batch(uuid,text,text,jsonb,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.begin_ticket_checkout_batch(uuid,text,text,jsonb,boolean,boolean,text,text) to service_role;

create or replace function public.save_ticket_checkout_batch_session(p_batch_id uuid,p_session_id text)
returns void language plpgsql security definer set search_path=public as $$
declare b public.ticket_checkout_batches;
begin
  update public.ticket_checkout_batches set stripe_checkout_session_id=p_session_id,updated_at=now() where id=p_batch_id and status='pending' and stripe_checkout_session_id is null returning * into b;
  if not found then raise exception 'Checkout can no longer be started'; end if;
  insert into public.payments(user_id,order_id,contact_id,checkout_batch_id,guest_email,stripe_checkout_session_id,amount,currency,status)
    select o.user_id,o.id,o.contact_id,b.id,case when o.user_id is null then o.buyer_email end,
      case when row_number() over(order by o.event_id)=1 then p_session_id end,o.amount_minor/100.0,o.currency,'pending'
    from public.ticket_orders o where o.id=any(b.order_ids);
end $$;
revoke all on function public.save_ticket_checkout_batch_session(uuid,text) from public,anon,authenticated;
grant execute on function public.save_ticket_checkout_batch_session(uuid,text) to service_role;

create or replace function public.fail_ticket_checkout_batch(p_batch_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.ticket_checkout_batches set status='failed',updated_at=now() where id=p_batch_id and status='pending' and stripe_checkout_session_id is null;
  update public.ticket_orders set status='failed',updated_at=now() where checkout_batch_id=p_batch_id and status='pending' and stripe_checkout_session_id is null;
end $$;
revoke all on function public.fail_ticket_checkout_batch(uuid) from public,anon,authenticated;
grant execute on function public.fail_ticket_checkout_batch(uuid) to service_role;

create or replace function public.apply_ticket_checkout_batch_event(p_type text,p_session jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare b public.ticket_checkout_batches; item public.ticket_order_items; attendee_name text; ix integer; event_lock uuid;
begin
  if p_session->>'livemode' is distinct from 'false' then raise exception 'Test mode required'; end if;
  select * into b from public.ticket_checkout_batches where id=(p_session->'metadata'->>'batch_id')::uuid for update;
  if not found then raise exception 'Unknown checkout'; end if;
  if p_session->>'id' is distinct from b.stripe_checkout_session_id or (p_session->>'amount_total')::bigint is distinct from b.amount_minor or lower(p_session->>'currency') is distinct from lower(b.currency) then raise exception 'Checkout session does not match order'; end if;
  if b.status in ('confirmed','free','manual_review') then return; end if;
  if p_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and p_session->>'payment_status'='paid' then
    if b.status in ('failed','expired') or b.expires_at<=now() then
      update public.ticket_checkout_batches set status='manual_review',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=b.id;
      update public.ticket_orders set status='manual_review',updated_at=now() where id=any(b.order_ids);
      update public.payments set status='paid',stripe_customer_id=p_session->>'customer',stripe_payment_intent_id=case when stripe_checkout_session_id is not null then p_session->>'payment_intent' else stripe_payment_intent_id end,updated_at=now() where checkout_batch_id=b.id;
      return;
    end if;
    for event_lock in select o.event_id from public.ticket_orders o join public.events e on e.id=o.event_id where o.id=any(b.order_ids) group by o.event_id,e.slug order by e.slug loop
      perform 1 from public.events where id=event_lock for update;
    end loop;
    if exists(select 1 from public.ticket_orders o join public.events e on e.id=o.event_id where o.checkout_batch_id=b.id and e.capacity is not null and
      (select count(*) from public.ticket_attendees a where a.event_id=e.id and a.status in ('valid','checked_in'))+
      (select count(*) from public.registrations r where r.event_id=e.id and r.status in ('pending','confirmed','checked_in'))+
      (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders po on po.id=oi.order_id where po.event_id=e.id and po.status in ('pending','processing') and po.expires_at>now() and po.checkout_batch_id is distinct from b.id)+
      (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi where oi.order_id=o.id)>e.capacity) then
      update public.ticket_checkout_batches set status='manual_review',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=b.id;
      update public.ticket_orders set status='manual_review',updated_at=now() where id=any(b.order_ids);
      update public.payments set status='paid',stripe_customer_id=p_session->>'customer',stripe_payment_intent_id=case when stripe_checkout_session_id is not null then p_session->>'payment_intent' else stripe_payment_intent_id end,updated_at=now() where checkout_batch_id=b.id;
      return;
    end if;
    if exists(select 1 from public.ticket_orders o join public.ticket_order_items own_item on own_item.order_id=o.id join public.ticket_types t on t.id=own_item.ticket_type_id
      where o.checkout_batch_id=b.id and t.capacity is not null and
      (select count(*) from public.ticket_attendees a where a.ticket_type_id=t.id and a.status in ('valid','checked_in'))+
      (select count(*) from public.registrations r where r.ticket_type_id=t.id and r.status in ('pending','confirmed','checked_in'))+
      (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders other_order on other_order.id=oi.order_id where oi.ticket_type_id=t.id and other_order.status in ('pending','processing') and other_order.expires_at>now() and other_order.checkout_batch_id is distinct from b.id)+
      own_item.quantity>t.capacity) then
      update public.ticket_checkout_batches set status='manual_review',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=b.id;
      update public.ticket_orders set status='manual_review',updated_at=now() where id=any(b.order_ids);
      update public.payments set status='paid',stripe_customer_id=p_session->>'customer',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where checkout_batch_id=b.id;
      return;
    end if;
    for item in select oi.* from public.ticket_order_items oi where oi.order_id=any(b.order_ids) loop
      for ix in 1..item.quantity loop
        attendee_name := item.attendee_names[ix];
        insert into public.ticket_attendees(order_id,order_item_id,event_id,ticket_type_id,user_id,attendee_name,attendee_email)
          select o.id,item.id,o.event_id,item.ticket_type_id,o.user_id,coalesce(attendee_name,o.buyer_name),o.buyer_email from public.ticket_orders o where o.id=item.order_id;
      end loop;
    end loop;
    update public.ticket_orders set status='confirmed',updated_at=now() where id=any(b.order_ids);
    update public.ticket_checkout_batches set status='confirmed',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=b.id;
    update public.payments set status='paid',stripe_customer_id=p_session->>'customer',stripe_payment_intent_id=case when stripe_checkout_session_id is not null then p_session->>'payment_intent' else stripe_payment_intent_id end,updated_at=now() where checkout_batch_id=b.id;
  elsif p_type='checkout.session.completed' then
    update public.ticket_checkout_batches set status='processing',updated_at=now() where id=b.id;
    update public.ticket_orders set status='processing',updated_at=now() where id=any(b.order_ids);
  elsif p_type in ('checkout.session.expired','checkout.session.async_payment_failed') then
    update public.ticket_checkout_batches set status=case when p_type='checkout.session.expired' then 'expired' else 'failed' end,updated_at=now() where id=b.id;
    update public.ticket_orders set status=case when p_type='checkout.session.expired' then 'expired' else 'failed' end,updated_at=now() where id=any(b.order_ids);
    update public.payments set status=case when p_type='checkout.session.expired' then 'void'::public.payment_status else 'failed'::public.payment_status end,updated_at=now() where checkout_batch_id=b.id;
  end if;
end $$;
revoke all on function public.apply_ticket_checkout_batch_event(text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_ticket_checkout_batch_event(text,jsonb) to service_role;

commit;
