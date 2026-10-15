-- Apply a member benefit to no more than one ticket per event and membership.
-- Split priced and full-price quantities into separate order lines so Stripe's
-- unit-price × quantity model exactly matches the server's quoted total.
begin;

-- A discounted and a full-price unit of the same ticket type must be separate
-- Stripe lines, so order/type is no longer unique. Capacity remains enforced
-- by the existing atomic order functions.
alter table public.ticket_order_items
  drop constraint if exists ticket_order_items_order_id_ticket_type_id_key;

create or replace function public.begin_ticket_order(
  p_user_id uuid,p_guest_name text,p_guest_email text,p_lines jsonb,p_payments_ready boolean,
  p_guest_token_hash text default null,p_guest_token_ciphertext text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare first_ticket uuid; event_row public.events; user_email text; buyer_name text; buyer_email text;
  contact uuid; plan_id uuid; tier text; benefits jsonb := '{}'::jsonb; order_id uuid;
  total_minor bigint := 0; item jsonb; ticket public.ticket_types; item_qty integer;
  unit_minor bigint; line_minor bigint; line_currency text; basis text; quote jsonb;
  public_minor bigint; attendee_ix integer; order_status text; expires timestamptz; item_row uuid;
  buyer_user uuid; benefit_used boolean := false; benefit_already_used boolean := false;
begin
  create temporary table if not exists ticket_order_quote (
    ticket_id uuid,ticket_name text,quantity integer,unit_minor bigint,line_minor bigint,
    currency text,basis text,public_minor bigint,benefit_type text,benefit_value numeric,tier text
  ) on commit drop;
  truncate table pg_temp.ticket_order_quote;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>10 then
    raise exception 'Choose between 1 and 10 ticket types'; end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x where x->>'ticket_id' is null or (x->>'quantity') !~ '^\d+$') then
    raise exception 'Invalid ticket selection'; end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'ticket_id' having count(*)>1) then
    raise exception 'Duplicate ticket type'; end if;
  if (select coalesce(sum((x->>'quantity')::integer),0) from jsonb_array_elements(p_lines) x)>10 then
    raise exception 'Choose no more than 10 tickets per order'; end if;
  first_ticket := (p_lines->0->>'ticket_id')::uuid;
  select e.* into event_row from public.events e join public.ticket_types t on t.event_id=e.id where t.id=first_ticket;
  if not found then raise exception 'Ticket unavailable'; end if;
  perform 1 from public.events where id=event_row.id for update;
  select * into event_row from public.events where id=event_row.id;
  buyer_user := p_user_id;
  if buyer_user is not null then
    select lower(u.email),nullif(trim(concat_ws(' ',p.first_name,p.last_name)),'') into user_email,buyer_name
      from auth.users u left join public.profiles p on p.id=u.id where u.id=buyer_user;
    if user_email is null then raise exception 'Please sign in again'; end if;
    buyer_email := user_email; buyer_name := coalesce(buyer_name,user_email);
    insert into public.contacts(email,first_name,last_name,source,newsletter_status,member_id)
      values(buyer_email,split_part(buyer_name,' ',1),case when position(' ' in buyer_name)>0 then substring(buyer_name from position(' ' in buyer_name)+1) end,'event_order','pending',buyer_user)
      on conflict(email) do update set member_id=coalesce(contacts.member_id,excluded.member_id),
        first_name=coalesce(nullif(contacts.first_name,''),excluded.first_name),
        last_name=coalesce(nullif(contacts.last_name,''),excluded.last_name),
        source=case when contacts.source='manual' then 'event_order' else contacts.source end,updated_at=now()
      where contacts.member_id is null or contacts.member_id=excluded.member_id returning id into contact;
  else
    buyer_email := lower(trim(coalesce(p_guest_email,''))); buyer_name := trim(coalesce(p_guest_name,''));
    if buyer_name='' or length(buyer_name)>240 or buyer_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Enter your name and a valid email address'; end if;
    if coalesce(length(p_guest_token_hash),0)<32 or coalesce(length(p_guest_token_ciphertext),0)<32 then
      raise exception 'Secure guest ticket access is not configured'; end if;
    insert into public.contacts(email,first_name,last_name,source,newsletter_status)
      values(buyer_email,split_part(buyer_name,' ',1),case when position(' ' in buyer_name)>0 then substring(buyer_name from position(' ' in buyer_name)+1) end,'event_order','pending')
      on conflict(email) do update set first_name=coalesce(nullif(contacts.first_name,''),excluded.first_name),
        last_name=coalesce(nullif(contacts.last_name,''),excluded.last_name),
        source=case when contacts.source='manual' then 'event_order' else contacts.source end,updated_at=now()
      returning id into contact;
  end if;
  if buyer_user is not null then
    select m.membership_plan_id into plan_id from public.memberships m
      where m.user_id=buyer_user and m.status='active' and m.starts_at<=now()
        and (m.ends_at is null or m.ends_at>now())
      order by m.starts_at desc limit 1 for share;
    select p.slug into tier from public.membership_plans p where p.id=plan_id;
    select coalesce(jsonb_object_agg(en.key,pe.value),'{}'::jsonb) into benefits
      from public.plan_entitlements pe join public.entitlements en on en.id=pe.entitlement_id
      where pe.membership_plan_id=plan_id;
    if tier is not null then
      select exists(
        select 1 from public.ticket_orders o
        join public.ticket_order_items oi on oi.order_id=o.id
        where o.user_id=buyer_user and oi.event_id=event_row.id
          and oi.membership_tier is not null and oi.benefit_type<>'public'
          and (o.status in ('processing','confirmed','free','manual_review')
            or (o.status='pending' and o.expires_at>now()))
      ) into benefit_already_used;
    end if;
  end if;
  line_currency := null;
  for item in select value from jsonb_array_elements(p_lines) loop
    item_qty := (item->>'quantity')::integer;
    if item_qty<1 or item_qty>10 then raise exception 'Invalid ticket quantity'; end if;
    select * into ticket from public.ticket_types where id=(item->>'ticket_id')::uuid and event_id=event_row.id and active for share;
    if not found then raise exception 'One of the selected tickets is unavailable'; end if;
    if event_row.publish_state<>'published' or event_row.event_status<>'registration_open' or event_row.start_date<=now()
      or (event_row.registration_start is not null and event_row.registration_start>now())
      or (event_row.registration_end is not null and event_row.registration_end<=now())
      or (ticket.sale_start is not null and ticket.sale_start>now()) or (ticket.sale_end is not null and ticket.sale_end<=now()) then
      raise exception 'Ticket sales are closed'; end if;
    if ticket.required_entitlement is not null and not (benefits ? ticket.required_entitlement) then
      raise exception 'This ticket type requires its listed CometX membership benefit'; end if;
    public_minor := round(ticket.base_price*100)::bigint;
    quote := public.quote_cometx_ticket(ticket.base_price,ticket.currency,ticket.member_price,event_row.event_type,
      case when benefit_already_used or benefit_used then null else tier end,
      benefits,ticket.free_entitlement,ticket.discount_entitlement);
    unit_minor := (quote->>'final_minor')::bigint;
    basis := case when quote->>'benefit_type'='free' then 'entitlement_free'
      when quote->>'benefit_type'='public' then 'public' else 'member' end;
    if line_currency is not null and line_currency<>upper(ticket.currency) then
      raise exception 'All ticket types in one order must use the same currency'; end if;
    line_currency := upper(ticket.currency);
    if unit_minor<public_minor and not benefit_already_used and not benefit_used then
      benefit_used := true;
      line_minor := unit_minor + public_minor*(item_qty-1);
      total_minor := total_minor + line_minor;
      insert into pg_temp.ticket_order_quote values(ticket.id,ticket.name,1,unit_minor,unit_minor,
        upper(ticket.currency),basis,public_minor,quote->>'benefit_type',(quote->>'benefit_value')::numeric,tier);
      if item_qty>1 then
        insert into pg_temp.ticket_order_quote values(ticket.id,ticket.name,item_qty-1,public_minor,public_minor*(item_qty-1),
          upper(ticket.currency),'public',public_minor,'public',0,null);
      end if;
    else
      unit_minor := public_minor;
      line_minor := unit_minor*item_qty;
      total_minor := total_minor + line_minor;
      insert into pg_temp.ticket_order_quote values(ticket.id,ticket.name,item_qty,unit_minor,line_minor,
        upper(ticket.currency),'public',public_minor,'public',0,null);
    end if;
    if ticket.capacity is not null and (
      (select count(*) from public.ticket_attendees a where a.ticket_type_id=ticket.id and a.status in ('valid','checked_in'))
      + (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders o on o.id=oi.order_id where oi.ticket_type_id=ticket.id and o.status in ('pending','processing') and o.expires_at>now())
      + (select count(*) from public.registrations r where r.ticket_type_id=ticket.id and r.status in ('pending','confirmed','checked_in'))
      + item_qty>ticket.capacity) then raise exception 'Not enough tickets of one selected type remain'; end if;
  end loop;
  if line_currency not in ('CHF','EUR','USD','GBP','CZK') then raise exception 'Unsupported ticket currency'; end if;
  if event_row.capacity is not null and (
    (select count(*) from public.ticket_attendees a where a.event_id=event_row.id and a.status in ('valid','checked_in'))
    + (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders o on o.id=oi.order_id where o.event_id=event_row.id and o.status in ('pending','processing') and o.expires_at>now())
    + (select count(*) from public.registrations r where r.event_id=event_row.id and r.status in ('pending','confirmed','checked_in'))
    + (select coalesce(sum((x->>'quantity')::integer),0) from jsonb_array_elements(p_lines) x)>event_row.capacity) then
    raise exception 'Not enough places remain for this order'; end if;
  if total_minor>0 and not p_payments_ready then raise exception 'Online payment setup is not complete'; end if;
  order_status := case when total_minor=0 then 'free' else 'pending' end;
  expires := now()+interval '90 minutes';
  insert into public.ticket_orders(event_id,user_id,contact_id,buyer_name,buyer_email,buyer_kind,amount_minor,currency,status,expires_at,guest_token_hash,guest_token_ciphertext)
    values(event_row.id,buyer_user,contact,buyer_name,buyer_email,case when buyer_user is null then 'guest' else 'member' end,
      total_minor,line_currency,order_status,expires,case when buyer_user is null then p_guest_token_hash end,
      case when buyer_user is null then p_guest_token_ciphertext end) returning id into order_id;
  for item in select to_jsonb(q.*) from pg_temp.ticket_order_quote q loop
    insert into public.ticket_order_items(order_id,ticket_type_id,ticket_name,quantity,unit_amount_minor,amount_minor,currency,
      price_basis,public_price_minor,benefit_type,benefit_value,membership_tier,final_price_minor)
      values(order_id,(item->>'ticket_id')::uuid,item->>'ticket_name',(item->>'quantity')::integer,
        (item->>'unit_minor')::bigint,(item->>'line_minor')::bigint,item->>'currency',item->>'basis',
        (item->>'public_minor')::bigint,item->>'benefit_type',(item->>'benefit_value')::numeric,
        item->>'tier',(item->>'unit_minor')::bigint) returning id into item_row;
    if total_minor=0 then
      for attendee_ix in 1..(item->>'quantity')::integer loop
        insert into public.ticket_attendees(order_id,order_item_id,event_id,ticket_type_id,user_id,attendee_name,attendee_email)
          values(order_id,item_row,event_row.id,(item->>'ticket_id')::uuid,buyer_user,buyer_name,buyer_email);
      end loop;
    end if;
  end loop;
  return jsonb_build_object('id',order_id,'event_id',event_row.id,'amount_minor',total_minor,'currency',line_currency,'status',order_status,'expires_at',expires);
exception when undefined_table then raise exception 'Ticket order schema is not initialized';
end $$;
revoke all on function public.begin_ticket_order(uuid,text,text,jsonb,boolean,text,text) from public,anon,authenticated;
grant execute on function public.begin_ticket_order(uuid,text,text,jsonb,boolean,text,text) to service_role;

create or replace function public.begin_ticket_checkout_batch(
  p_user_id uuid,p_guest_name text,p_guest_email text,p_events jsonb,p_terms_accepted boolean,p_payments_ready boolean,
  p_guest_token_hash text default null,p_guest_token_ciphertext text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; primary_order uuid; secondary_order uuid; batch_id uuid; expected_count integer;
  event_input jsonb; line_input jsonb; order_item record; attendee_start integer;
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
      attendee_start := 0;
      for order_item in
        select id,quantity from public.ticket_order_items
        where order_id=primary_order and ticket_type_id=(line_input->>'ticketId')::uuid
        order by (benefit_type='public'), id
      loop
        update public.ticket_order_items set attendee_details=(
          select coalesce(jsonb_agg(person.details order by person.position),'[]'::jsonb)
          from jsonb_array_elements(line_input->'attendees') with ordinality as person(details,position)
          where person.position>attendee_start and person.position<=attendee_start+order_item.quantity
        ) where id=order_item.id;
        attendee_start := attendee_start+order_item.quantity;
      end loop;
      if attendee_start<>(select jsonb_array_length(line_input->'attendees')) then
        raise exception 'Attendee details do not match ticket quantity';
      end if;
    end loop;
  end loop;
  insert into public.ticket_order_attendees(order_id,order_item_id,event_id,position,first_name,last_name)
    select oi.order_id,oi.id,oi.event_id,person.position::integer,
      trim(person.details->>'firstName'),trim(person.details->>'lastName')
    from public.ticket_order_items oi
    cross join lateral jsonb_array_elements(oi.attendee_details) with ordinality as person(details,position)
    where oi.order_id=primary_order;
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

commit;
