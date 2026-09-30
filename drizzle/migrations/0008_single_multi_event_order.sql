-- A checkout batch remains as the private guest-access envelope for older links.
-- New checkouts have exactly one order, one payment and event-scoped order lines.
begin;

alter table public.ticket_order_items add column event_id uuid references public.events(id);
update public.ticket_order_items oi set event_id=o.event_id from public.ticket_orders o where o.id=oi.order_id;
alter table public.ticket_order_items alter column event_id set not null;
comment on column public.ticket_orders.event_id is 'Legacy primary event reference; multi-event reporting and capacity use ticket_order_items.event_id.';
create index ticket_order_items_event_idx on public.ticket_order_items(event_id);
alter table public.ticket_order_items add column attendee_details jsonb not null default '[]'::jsonb
  check (jsonb_typeof(attendee_details)='array');
alter table public.ticket_attendees add column attendee_first_name text;
alter table public.ticket_attendees add column attendee_last_name text;
create table public.ticket_order_attendees (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ticket_orders(id) on delete cascade,
  order_item_id uuid not null references public.ticket_order_items(id) on delete cascade,
  event_id uuid not null references public.events(id),
  position integer not null check(position between 1 and 10),
  first_name text not null check(length(trim(first_name))>0),
  last_name text not null check(length(trim(last_name))>0),
  created_at timestamptz not null default now(),
  unique(order_item_id,position)
);
create index ticket_order_attendees_order_idx on public.ticket_order_attendees(order_id);
alter table public.ticket_order_attendees enable row level security;
revoke all on public.ticket_order_attendees from public,anon,authenticated;
grant all on public.ticket_order_attendees to service_role;
alter table public.ticket_attendees add column order_attendee_id uuid unique references public.ticket_order_attendees(id);

create function public.set_ticket_order_line_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  select event_id into new.event_id from public.ticket_types where id=new.ticket_type_id;
  if new.event_id is null then raise exception 'Ticket unavailable'; end if;
  return new;
end $$;
create trigger ticket_order_line_event before insert on public.ticket_order_items
  for each row execute function public.set_ticket_order_line_event();
revoke all on function public.set_ticket_order_line_event() from public,anon,authenticated;

create or replace function public.check_ticket_order_line_capacity()
returns trigger language plpgsql security definer set search_path=public as $$
declare o public.ticket_orders; event_cap integer; type_cap integer; occupied bigint; pending_count bigint;
begin
  select * into o from public.ticket_orders where id=new.order_id;
  if not found then raise exception 'Order unavailable'; end if;
  if new.event_id is null or not exists(select 1 from public.ticket_types where id=new.ticket_type_id and event_id=new.event_id) then
    raise exception 'Ticket does not belong to its event';
  end if;
  -- Both checkout paths take the same event lock before committing a hold.
  perform 1 from public.events where id=new.event_id for update;
  select capacity into event_cap from public.events where id=new.event_id;
  select capacity into type_cap from public.ticket_types where id=new.ticket_type_id;
  if event_cap is not null then
    select (select count(*) from public.ticket_attendees where event_id=new.event_id and status in ('valid','checked_in'))
      + (select count(*) from public.registrations where event_id=new.event_id and status in ('pending','confirmed','checked_in'))
      into occupied;
    select coalesce(sum(oi.quantity),0) into pending_count from public.ticket_order_items oi
      join public.ticket_orders ord on ord.id=oi.order_id
      where oi.event_id=new.event_id and ord.status in ('pending','processing') and ord.expires_at>now();
    if occupied+pending_count+(case when o.status='free' then new.quantity else 0 end)>event_cap then
      raise exception 'Not enough places remain for this event';
    end if;
  end if;
  if type_cap is not null then
    select (select count(*) from public.ticket_attendees where ticket_type_id=new.ticket_type_id and status in ('valid','checked_in'))
      + (select count(*) from public.registrations where ticket_type_id=new.ticket_type_id and status in ('pending','confirmed','checked_in'))
      into occupied;
    select coalesce(sum(oi.quantity),0) into pending_count from public.ticket_order_items oi
      join public.ticket_orders ord on ord.id=oi.order_id
      where oi.ticket_type_id=new.ticket_type_id and ord.status in ('pending','processing') and ord.expires_at>now();
    if occupied+pending_count+(case when o.status='free' then new.quantity else 0 end)>type_cap then
      raise exception 'Not enough tickets of this type remain';
    end if;
  end if;
  return new;
end $$;
create trigger ticket_order_line_capacity after insert on public.ticket_order_items
  for each row execute function public.check_ticket_order_line_capacity();
revoke all on function public.check_ticket_order_line_capacity() from public,anon,authenticated;

-- Retain the previous RPC for existing clients; the new RPC consolidates its
-- atomically quoted, capacity-held per-event orders before it returns.
alter function public.begin_ticket_checkout_batch(uuid,text,text,jsonb,boolean,boolean,text,text)
  rename to begin_ticket_checkout_batch_legacy;
create function public.begin_ticket_checkout_batch(
  p_user_id uuid,p_guest_name text,p_guest_email text,p_events jsonb,p_terms_accepted boolean,p_payments_ready boolean,
  p_guest_token_hash text default null,p_guest_token_ciphertext text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; primary_order uuid; secondary_order uuid; batch_id uuid; expected_count integer;
  event_input jsonb; line_input jsonb;
begin
  result := public.begin_ticket_checkout_batch_legacy(p_user_id,p_guest_name,p_guest_email,p_events,p_terms_accepted,
    p_payments_ready,p_guest_token_hash,p_guest_token_ciphertext);
  batch_id := (result->>'id')::uuid;
  primary_order := (result->'order_ids'->>0)::uuid;
  expected_count := jsonb_array_length(result->'order_ids');
  if expected_count>1 then
    for secondary_order in select value::uuid from jsonb_array_elements_text(result->'order_ids') with ordinality as ids(value,ord)
      where ord>1 loop
      update public.ticket_order_items set order_id=primary_order where order_id=secondary_order;
      update public.ticket_attendees set order_id=primary_order where order_id=secondary_order;
      delete from public.ticket_orders where id=secondary_order;
    end loop;
  end if;
  update public.ticket_orders set amount_minor=(result->>'amount_minor')::bigint,
    expires_at=(result->>'expires_at')::timestamptz where id=primary_order;
  for event_input in select value from jsonb_array_elements(p_events) loop
    for line_input in select value from jsonb_array_elements(event_input->'lines') loop
      update public.ticket_order_items set attendee_details=line_input->'attendees'
        where order_id=primary_order and ticket_type_id=(line_input->>'ticketId')::uuid;
    end loop;
  end loop;
  insert into public.ticket_order_attendees(order_id,order_item_id,event_id,position,first_name,last_name)
    select oi.order_id,oi.id,oi.event_id,person.position::integer,
      trim(person.details->>'firstName'),trim(person.details->>'lastName')
    from public.ticket_order_items oi
    cross join lateral jsonb_array_elements(oi.attendee_details) with ordinality as person(details,position)
    where oi.order_id=primary_order;
  -- The legacy helper immediately issues all-free tickets; enrich those rows
  -- with the independently captured attendee first and last names.
  update public.ticket_attendees a set
    attendee_first_name=entry.first_name,attendee_last_name=entry.last_name,order_attendee_id=entry.attendee_id
  from (select ranked.id,person.id as attendee_id,person.first_name,person.last_name
    from (select a2.id,a2.order_item_id,row_number() over(partition by a2.order_item_id order by a2.created_at,a2.id) as position
      from public.ticket_attendees a2 where a2.order_id=primary_order) ranked
    join public.ticket_order_attendees person on person.order_item_id=ranked.order_item_id and person.position=ranked.position) entry
  where a.id=entry.id;
  update public.ticket_checkout_batches set order_ids=array[primary_order] where id=batch_id;
  return jsonb_set(jsonb_set(result,'{order_ids}',jsonb_build_array(primary_order)),'{order_id}',to_jsonb(primary_order));
end $$;
revoke all on function public.begin_ticket_checkout_batch(uuid,text,text,jsonb,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.begin_ticket_checkout_batch(uuid,text,text,jsonb,boolean,boolean,text,text) to service_role;

-- Legacy session creation already inserts one payment per order; with the
-- consolidated order it now inserts exactly one payment for the whole cart.

alter function public.apply_ticket_checkout_batch_event(text,jsonb) rename to apply_ticket_checkout_batch_event_legacy;
create function public.apply_ticket_checkout_batch_event(p_type text,p_session jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare b public.ticket_checkout_batches; order_row public.ticket_orders; line public.ticket_order_items;
  attendee public.ticket_order_attendees; event_lock uuid; checkout_order_id uuid;
begin
  if p_session->>'livemode' is distinct from 'false' then raise exception 'Test mode required'; end if;
  checkout_order_id := (p_session->'metadata'->>'order_id')::uuid;
  select * into b from public.ticket_checkout_batches where id=(p_session->'metadata'->>'batch_id')::uuid for update;
  if not found then raise exception 'Unknown checkout'; end if;
  if array_length(b.order_ids,1)>1 then
    perform public.apply_ticket_checkout_batch_event_legacy(p_type,p_session);
    return;
  end if;
  if array_length(b.order_ids,1)<>1 or b.order_ids[1] is distinct from checkout_order_id then
    raise exception 'Checkout order does not match';
  end if;
  select * into order_row from public.ticket_orders where id=checkout_order_id for update;
  if not found or order_row.checkout_batch_id is distinct from b.id then raise exception 'Order unavailable'; end if;
  if order_row.amount_minor is distinct from b.amount_minor or order_row.currency is distinct from b.currency
    or (select coalesce(sum(amount_minor),0) from public.ticket_order_items where order_id=checkout_order_id) is distinct from b.amount_minor then
    raise exception 'Order lines do not match checkout total';
  end if;
  if p_session->>'id' is distinct from b.stripe_checkout_session_id
    or (p_session->>'amount_total')::bigint is distinct from b.amount_minor
    or lower(p_session->>'currency') is distinct from lower(b.currency) then
    raise exception 'Checkout session does not match order';
  end if;
  if b.status in ('confirmed','free','manual_review') then return; end if;
  if p_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and p_session->>'payment_status'='paid' then
    if b.status in ('failed','expired') or b.expires_at<=now() then
      update public.ticket_checkout_batches set status='manual_review',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=b.id;
      update public.ticket_orders set status='manual_review',updated_at=now() where id=checkout_order_id;
    else
      for event_lock in select e.id from public.ticket_order_items oi
        join public.events e on e.id=oi.event_id where oi.order_id=checkout_order_id
        group by e.id,e.slug order by e.slug loop
        perform 1 from public.events where id=event_lock for update;
      end loop;
      if exists(select 1 from public.events e where e.id in
        (select oi.event_id from public.ticket_order_items oi where oi.order_id=checkout_order_id)
        and e.capacity is not null and
        (select count(*) from public.ticket_attendees a where a.event_id=e.id and a.status in ('valid','checked_in'))+
        (select count(*) from public.registrations r where r.event_id=e.id and r.status in ('pending','confirmed','checked_in'))+
        (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders o on o.id=oi.order_id
          where oi.event_id=e.id and o.status in ('pending','processing') and o.expires_at>now() and o.id<>checkout_order_id)+
        (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi where oi.event_id=e.id and oi.order_id=checkout_order_id)>e.capacity)
      or exists(select 1 from public.ticket_types t where t.id in
        (select oi.ticket_type_id from public.ticket_order_items oi where oi.order_id=checkout_order_id)
        and t.capacity is not null and
        (select count(*) from public.ticket_attendees a where a.ticket_type_id=t.id and a.status in ('valid','checked_in'))+
        (select count(*) from public.registrations r where r.ticket_type_id=t.id and r.status in ('pending','confirmed','checked_in'))+
        (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders o on o.id=oi.order_id
          where oi.ticket_type_id=t.id and o.status in ('pending','processing') and o.expires_at>now() and o.id<>checkout_order_id)+
        (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi where oi.ticket_type_id=t.id and oi.order_id=checkout_order_id)>t.capacity) then
        update public.ticket_checkout_batches set status='manual_review',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=b.id;
        update public.ticket_orders set status='manual_review',updated_at=now() where id=checkout_order_id;
      else
        for line in select * from public.ticket_order_items where order_id=checkout_order_id order by id loop
          if (select count(*) from public.ticket_order_attendees where order_item_id=line.id)<>line.quantity then
            raise exception 'Attendee details do not match ticket quantity';
          end if;
          for attendee in select * from public.ticket_order_attendees where order_item_id=line.id order by position loop
            insert into public.ticket_attendees(order_id,order_item_id,event_id,ticket_type_id,user_id,attendee_name,attendee_email,attendee_first_name,attendee_last_name,order_attendee_id)
              values(checkout_order_id,line.id,line.event_id,line.ticket_type_id,order_row.user_id,
                attendee.first_name||' '||attendee.last_name,order_row.buyer_email,attendee.first_name,attendee.last_name,attendee.id);
          end loop;
        end loop;
        update public.ticket_orders set status='confirmed',stripe_checkout_session_id=p_session->>'id',
          stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=checkout_order_id;
        update public.ticket_checkout_batches set status='confirmed',stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where id=b.id;
      end if;
    end if;
    update public.payments set status='paid',stripe_customer_id=p_session->>'customer',
      stripe_payment_intent_id=p_session->>'payment_intent',updated_at=now() where order_id=checkout_order_id;
  elsif p_type='checkout.session.completed' then
    update public.ticket_checkout_batches set status='processing',updated_at=now() where id=b.id;
    update public.ticket_orders set status='processing',updated_at=now() where id=checkout_order_id;
  elsif p_type in ('checkout.session.expired','checkout.session.async_payment_failed') then
    update public.ticket_checkout_batches set status=case when p_type='checkout.session.expired' then 'expired' else 'failed' end,updated_at=now() where id=b.id;
    update public.ticket_orders set status=case when p_type='checkout.session.expired' then 'expired' else 'failed' end,updated_at=now() where id=checkout_order_id;
    update public.payments set status=case when p_type='checkout.session.expired' then 'void'::public.payment_status else 'failed'::public.payment_status end,
      updated_at=now() where order_id=checkout_order_id;
  end if;
end $$;
revoke all on function public.apply_ticket_checkout_batch_event(text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_ticket_checkout_batch_event(text,jsonb) to service_role;

commit;
