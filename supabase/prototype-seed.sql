-- Repeatable sample content. Does not create users or change existing event content.
begin;
insert into public.entitlements(key,name) values
 ('symposium_free_ticket','Symposium included'),('potlach_discount','POTLA.CH discount') on conflict(key) do nothing;
insert into public.membership_plans(name,slug,description,annual_price,sort_order) values
 ('Fanoušek','fanousek','Užijte si online obsah a největší networkingovou akci pro Čechy a Slováky ve Švýcarsku.',90,1),
 ('CometXXL','cometxxl','Kompletní ochutnávka všeho, co tvoříme.',250,2),
 ('Ambasador','ambasador','Buďte u všeho, co CometX dělá, a šiřte myšlenku, že networking pomáhá.',599,3)
 on conflict(slug) do nothing;
insert into public.plan_entitlements(membership_plan_id,entitlement_id,value)
 select p.id,e.id,v.amount from (values ('fanousek','potlach_discount',20),('cometxxl','potlach_discount',50),('cometxxl','symposium_free_ticket',1),('ambasador','potlach_discount',50),('ambasador','symposium_free_ticket',1)) v(slug,key,amount)
 join public.membership_plans p on p.slug=v.slug join public.entitlements e on e.key=v.key
 on conflict(membership_plan_id,entitlement_id) do nothing;
insert into public.events(title,slug,short_description,description,start_date,venue,capacity,status,featured,hero_image_url) values
 ('6th Slovak and Czech Annual Symposium 2026','annual-symposium-2026','The largest networking event for Czech and Slovak professionals in Switzerland.','The completed 2026 edition brought talks, panel discussions, workshops and an evening apero to UZH Irchel Campus in Zurich.','2026-09-11 09:00:00+02','UZH Zürich, Irchel Campus',320,'completed',true,'/assets/cometx/symposium-2026.png'),
 ('Beer POTLA.CH Zurich','beer-potlach-zurich','An informal evening with the community.','Stakeholder demo event. Meet fellow Czech and Slovak professionals in Switzerland.',now()+interval '21 days','Zurich',120,'registration_open',false,'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=1600&q=80'),
 ('Networking Evening Geneva','networking-evening-geneva','Connect with professionals in French-speaking Switzerland.','Stakeholder demo event. A relaxed evening of introductions and conversation.',now()+interval '35 days','Geneva',60,'registration_open',false,'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1600&q=80') on conflict(slug) do nothing;
insert into public.ticket_types(event_id,name,base_price,free_entitlement,discount_entitlement)
 select e.id,'Standard ticket',v.price,v.free,v.discount from (values
 ('annual-symposium-2026',120,'symposium_free_ticket'::text,null::text),
 ('beer-potlach-zurich',30,null,'potlach_discount'),
 ('networking-evening-geneva',20,null,'potlach_discount')) v(slug,price,free,discount)
 join public.events e on e.slug=v.slug where not exists(select 1 from public.ticket_types t where t.event_id=e.id);
commit;
