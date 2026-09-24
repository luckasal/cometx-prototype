-- Apply after drizzle/migrations/0000_cometx_core_schema.sql on a NEW project.
-- Stakeholder prototype only: memberships are self-selected, no money is taken.
begin;
grant insert,update,delete on public.events, public.ticket_types, public.event_speakers,
 public.memberships, public.membership_plans, public.plan_entitlements, public.entitlements,
 public.speakers, public.partners, public.event_partners, public.workshops,
 public.registrations, public.articles to authenticated;
drop policy if exists "articles public read" on public.articles;
create policy "articles public read" on public.articles for select to anon,authenticated
 using ((status='published' and visibility='public') or public.is_admin());
alter table public.registrations add column if not exists quoted_price numeric(10,2) not null default 0;

create or replace function public.select_prototype_membership(p_plan_slug text)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); pid uuid; result uuid;
begin
 if uid is null then raise exception 'Please log in.'; end if;
 perform 1 from auth.users where id=uid for update;
 select id into pid from public.membership_plans where slug=p_plan_slug and active;
 if pid is null then raise exception 'Plan unavailable.'; end if;
 update public.memberships set status='inactive' where user_id=uid and status='active';
 insert into public.memberships(user_id,membership_plan_id,status,ends_at)
 values(uid,pid,'active',now()+interval '1 year') returning id into result;
 return result;
end $$;
revoke all on function public.select_prototype_membership(text) from public,anon;
grant execute on function public.select_prototype_membership(text) to authenticated;

create or replace function public.register_prototype_ticket(p_ticket_type_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); t public.ticket_types; e public.events; eid uuid; pid uuid;
 benefits jsonb; amount numeric; result uuid;
begin
 if uid is null then raise exception 'Please log in.'; end if;
 select event_id into eid from public.ticket_types where id=p_ticket_type_id;
 select * into e from public.events where id=eid for update;
 select * into t from public.ticket_types where id=p_ticket_type_id and active for share;
 if t.id is null or e.id is null then raise exception 'Ticket unavailable.'; end if;
 if e.status not in ('published','registration_open') or e.start_date<=now()
 or (e.registration_start is not null and e.registration_start>now())
 or (e.registration_end is not null and e.registration_end<now()) then raise exception 'Registration is closed.'; end if;
 if exists(select 1 from public.registrations where event_id=e.id and user_id=uid and status in ('pending','confirmed','checked_in')) then raise exception 'You are already registered.'; end if;
 if e.capacity is not null and (select count(*) from public.registrations where event_id=e.id and status in ('pending','confirmed','checked_in'))>=e.capacity then raise exception 'Event is full.'; end if;
 if t.capacity is not null and (select count(*) from public.registrations where ticket_type_id=t.id and status in ('pending','confirmed','checked_in'))>=t.capacity then raise exception 'Ticket is sold out.'; end if;
 select membership_plan_id into pid from public.memberships where user_id=uid and status='active' and starts_at<=now() and (ends_at is null or ends_at>now()) order by starts_at desc limit 1;
 select coalesce(jsonb_object_agg(en.key,pe.value),'{}'::jsonb) into benefits from public.plan_entitlements pe join public.entitlements en on en.id=pe.entitlement_id where pe.membership_plan_id=pid;
 if t.required_entitlement is not null and not (benefits ? t.required_entitlement) then raise exception 'Membership benefit required.'; end if;
 if t.base_price<0 then raise exception 'Invalid ticket price.'; end if;
 amount:=t.base_price;
 if t.free_entitlement is not null and benefits ? t.free_entitlement then amount:=0;
 elsif t.discount_entitlement is not null and benefits ? t.discount_entitlement then amount:=t.base_price-round(t.base_price*least(100,greatest(0,coalesce((benefits->>t.discount_entitlement)::numeric,0)))/100,2); end if;
 insert into public.registrations(event_id,user_id,ticket_type_id,status,price_paid,quoted_price,currency)
 values(e.id,uid,t.id,'confirmed',0,amount,t.currency) returning id into result;
 return result;
end $$;
revoke all on function public.register_prototype_ticket(uuid) from public,anon;
grant execute on function public.register_prototype_ticket(uuid) to authenticated;
commit;
