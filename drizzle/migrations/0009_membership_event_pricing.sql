-- Event categories and membership quotes are authoritative at order creation.
begin;

alter table public.events alter column event_type set default 'regular_event';
update public.events set event_type='regular_event' where event_type='event';
update public.events set event_type='symposium' where slug='annual-symposium-2026';
update public.events set event_type='potlach' where slug='beer-potlach-zurich';
update public.events set event_type='workshop' where slug in
  ('emocni-regulace-v-kazdodenni-praxi','co-ai-nevyresi','jak-resit-konflikty-s-toxickymi-osobnostmi');
insert into public.entitlements(key,name,description) values
  ('symposium_half_price','SCAS Symposium 50% discount','Fanoušek SCAS Symposium benefit'),
  ('other_events_discount','Other events 50% discount','CometXXL regular event benefit'),
  ('potlach_free_ticket','Beer POTLA.CH admission','Ambasador Beer POTLA.CH benefit')
on conflict(key) do nothing;
insert into public.plan_entitlements(membership_plan_id,entitlement_id,value)
select p.id,e.id,v.value from (values
  ('fanousek','symposium_half_price',50::numeric),
  ('cometxxl','symposium_free_ticket',1::numeric),
  ('cometxxl','other_events_discount',50::numeric),
  ('cometxxl','workshop_credit',100::numeric),
  ('ambasador','symposium_free_ticket',1::numeric),
  ('ambasador','potlach_free_ticket',1::numeric),
  ('ambasador','workshop_credit',300::numeric)
) as v(plan_slug,entitlement_key,value)
join public.membership_plans p on p.slug=v.plan_slug
join public.entitlements e on e.key=v.entitlement_key
on conflict(membership_plan_id,entitlement_id) do update set value=excluded.value;
-- Legacy prototype seeds guessed POTLA.CH percentages. The verified membership
-- content does not specify a percentage; staff must explicitly configure one.
delete from public.plan_entitlements pe using public.membership_plans p, public.entitlements e
where pe.membership_plan_id=p.id and pe.entitlement_id=e.id
  and e.key='potlach_discount'
  and ((p.slug='fanousek' and pe.value=20)
    or (p.slug in ('cometxxl','ambasador') and pe.value=50));

alter table public.ticket_order_items
  add column public_price_minor bigint check (public_price_minor>=0),
  add column benefit_type text check (benefit_type in ('public','free','workshop_credit','percent_discount','member_price')),
  add column benefit_value numeric check (benefit_value>=0),
  add column membership_tier text,
  add column final_price_minor bigint check (final_price_minor>=0);
comment on column public.ticket_order_items.public_price_minor is 'Unit public price at purchase time; NULL for legacy orders.';
comment on column public.ticket_order_items.final_price_minor is 'Server-calculated unit final price at purchase time; NULL for legacy orders.';

create function public.quote_cometx_ticket(
  p_public numeric, p_currency text, p_member numeric, p_event_type text,
  p_tier text, p_benefits jsonb, p_free_key text, p_discount_key text
) returns jsonb language plpgsql stable set search_path=public as $$
declare kind text := 'public'; value numeric := 0; result_minor bigint;
  public_minor bigint := round(p_public*100)::bigint; credit numeric;
  percent numeric := 0; percent_minor bigint; explicit_minor bigint;
begin
  if p_public<0 or p_public is null then raise exception 'Invalid ticket price'; end if;
  result_minor := public_minor;
  if p_tier is null then
    return jsonb_build_object('final_minor',result_minor,'benefit_type',kind,'benefit_value',value);
  end if;
  if (p_free_key is not null and p_benefits ? p_free_key)
     or (p_event_type='symposium' and p_tier in ('cometxxl','ambasador') and p_benefits ? 'symposium_free_ticket')
     or (p_event_type='potlach' and p_tier='ambasador' and p_benefits ? 'potlach_free_ticket') then
    return jsonb_build_object('final_minor',0,'benefit_type','free','benefit_value',p_public);
  end if;
  if p_event_type='workshop' and upper(p_currency)='CHF' and p_tier in ('cometxxl','ambasador') then
    credit := case when p_tier='cometxxl' then 100 else 300 end;
    if p_benefits ? 'workshop_credit' and (p_benefits->>'workshop_credit')::numeric=credit then
      return jsonb_build_object('final_minor',greatest(0,public_minor-credit*100),
        'benefit_type','workshop_credit','benefit_value',least(p_public,credit));
    end if;
  end if;
  if p_event_type='symposium' and p_tier='fanousek' and p_benefits ? 'symposium_half_price' then
    percent := greatest(percent,least(100,greatest(0,(p_benefits->>'symposium_half_price')::numeric)));
  elsif p_event_type in ('regular_event','event') and p_tier='cometxxl' and p_benefits ? 'other_events_discount' then
    percent := greatest(percent,least(100,greatest(0,(p_benefits->>'other_events_discount')::numeric)));
  elsif p_event_type='potlach' and p_benefits ? 'potlach_discount' then
    percent := greatest(percent,least(100,greatest(0,(p_benefits->>'potlach_discount')::numeric)));
  end if;
  if p_discount_key is not null and p_benefits ? p_discount_key
    and (p_tier not in ('fanousek','cometxxl','ambasador')
      or (p_event_type<>'workshop' and (p_event_type<>'potlach' or p_discount_key='potlach_discount'))) then
    percent := greatest(percent,least(100,greatest(0,coalesce((p_benefits->>p_discount_key)::numeric,0))));
  end if;
  if percent>0 then
    percent_minor := round((p_public-round(p_public*percent/100,2))*100)::bigint;
    result_minor := greatest(0,percent_minor); kind := 'percent_discount'; value := percent;
  end if;
  if p_event_type<>'workshop' and p_member is not null then
    if p_member<0 then raise exception 'Invalid member ticket price'; end if;
    explicit_minor := round(p_member*100)::bigint;
    if explicit_minor<result_minor then
      result_minor := explicit_minor; kind := 'member_price'; value := (public_minor-result_minor)/100.0;
    end if;
  end if;
  return jsonb_build_object('final_minor',result_minor,'benefit_type',kind,'benefit_value',value);
end $$;
revoke all on function public.quote_cometx_ticket(numeric,text,numeric,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.quote_cometx_ticket(numeric,text,numeric,text,text,jsonb,text,text) to service_role;

create or replace function public.begin_ticket_order(
  p_user_id uuid,p_guest_name text,p_guest_email text,p_lines jsonb,p_payments_ready boolean,
  p_guest_token_hash text default null,p_guest_token_ciphertext text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare first_ticket uuid; event_row public.events; user_email text; buyer_name text; buyer_email text;
  contact uuid; plan_id uuid; tier text; benefits jsonb := '{}'::jsonb; order_id uuid;
  total_minor bigint := 0; item jsonb; ticket public.ticket_types; item_qty integer;
  unit_minor bigint; line_minor bigint; line_currency text; basis text; quote jsonb;
  attendee_ix integer; order_status text; expires timestamptz; item_row uuid; buyer_user uuid;
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
    quote := public.quote_cometx_ticket(ticket.base_price,ticket.currency,ticket.member_price,event_row.event_type,
      tier,benefits,ticket.free_entitlement,ticket.discount_entitlement);
    unit_minor := (quote->>'final_minor')::bigint;
    basis := case when quote->>'benefit_type'='free' then 'entitlement_free'
      when quote->>'benefit_type'='public' then 'public' else 'member' end;
    if line_currency is not null and line_currency<>upper(ticket.currency) then
      raise exception 'All ticket types in one order must use the same currency'; end if;
    line_currency := upper(ticket.currency); line_minor := unit_minor*item_qty;
    if ticket.capacity is not null and (
      (select count(*) from public.ticket_attendees a where a.ticket_type_id=ticket.id and a.status in ('valid','checked_in'))
      + (select coalesce(sum(oi.quantity),0) from public.ticket_order_items oi join public.ticket_orders o on o.id=oi.order_id where oi.ticket_type_id=ticket.id and o.status in ('pending','processing') and o.expires_at>now())
      + (select count(*) from public.registrations r where r.ticket_type_id=ticket.id and r.status in ('pending','confirmed','checked_in'))
      + item_qty>ticket.capacity) then raise exception 'Not enough tickets of one selected type remain'; end if;
    total_minor := total_minor+line_minor;
    insert into pg_temp.ticket_order_quote(ticket_id,ticket_name,quantity,unit_minor,line_minor,currency,basis,public_minor,benefit_type,benefit_value,tier)
      values(ticket.id,ticket.name,item_qty,unit_minor,line_minor,upper(ticket.currency),basis,
        round(ticket.base_price*100)::bigint,quote->>'benefit_type',(quote->>'benefit_value')::numeric,tier);
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

commit;
