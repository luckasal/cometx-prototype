-- Verified on official CometX event pages, 2026-09-25.
-- https://cs.cometx.ch/event-details-registration/emocni-regulace-workshop
-- https://www.cometx.ch/event-details-registration/co-ai-nevyresi
-- https://www.cometx.ch/event-details-registration/jak-resit-konflikty-s-toxickymi-osobnostmi
-- Data repair only: preserve existing tickets, registrations, capacity and entitlements.
begin;
insert into public.ticket_types (event_id,name,base_price,currency,active,sort_order)
select e.id,v.name,v.price,'CHF',v.active,v.sort_order
from (values
 ('emocni-regulace-v-kazdodenni-praxi','Vstupenka na workshop',265::numeric,true,0),
 ('co-ai-nevyresi','Regular Vstupenka',315::numeric,true,0),
 ('co-ai-nevyresi','Early bird Vstupenka',230::numeric,false,1),
 ('jak-resit-konflikty-s-toxickymi-osobnostmi','Regular Vstupenka',554::numeric,true,0),
 ('jak-resit-konflikty-s-toxickymi-osobnostmi','Early Bird Vstupenka',322::numeric,false,1)
) v(slug,name,price,active,sort_order)
join public.events e on e.slug=v.slug
where not exists (select 1 from public.ticket_types t where t.event_id=e.id and t.name=v.name);
-- Only supply missing deadlines; don't overwrite staff changes.
update public.events e set registration_end=v.deadline
from (values
 ('emocni-regulace-v-kazdodenni-praxi','2026-10-10T23:59:00+02:00'::timestamptz),
 ('co-ai-nevyresi','2027-01-14T23:59:00+01:00'::timestamptz),
 ('jak-resit-konflikty-s-toxickymi-osobnostmi','2027-03-10T23:59:00+01:00'::timestamptz)
) v(slug,deadline)
where e.slug=v.slug and e.registration_end is null;
commit;
select e.slug,t.name,t.base_price,t.active,e.registration_end
from public.events e join public.ticket_types t on t.event_id=e.id
where e.slug in ('emocni-regulace-v-kazdodenni-praxi','co-ai-nevyresi','jak-resit-konflikty-s-toxickymi-osobnostmi')
order by e.slug,t.sort_order;

