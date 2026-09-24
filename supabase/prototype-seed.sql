-- Repeatable sample content. Does not create users or change existing event content.
begin;
insert into public.entitlements(key,name) values
 ('symposium_free_ticket','Symposium included'),('potlach_discount','POTLA.CH discount') on conflict(key) do nothing;
insert into public.membership_plans(name,slug,description,annual_price,sort_order) values
 ('Fanousek','fanousek','Support the community and get discounted networking tickets.',60,1),
 ('CometXXL','cometxxl','Symposium included and half-price POTLA.CH tickets.',240,2),
 ('Ambasador','ambasador','Support CometX with symposium access and member event benefits.',480,3)
 on conflict(slug) do nothing;
insert into public.plan_entitlements(membership_plan_id,entitlement_id,value)
 select p.id,e.id,v.amount from (values ('fanousek','potlach_discount',20),('cometxxl','potlach_discount',50),('cometxxl','symposium_free_ticket',1),('ambasador','potlach_discount',50),('ambasador','symposium_free_ticket',1)) v(slug,key,amount)
 join public.membership_plans p on p.slug=v.slug join public.entitlements e on e.key=v.key
 on conflict(membership_plan_id,entitlement_id) do nothing;
insert into public.events(title,slug,short_description,description,start_date,venue,capacity,status,featured,hero_image_url) values
 ('CometX Annual Symposium 2026','annual-symposium-2026','One day of ideas and connections in Zurich.','Stakeholder demo event: talks, workshops and networking. Dates and prices are illustrative.',now()+interval '60 days','Kraftwerk Zurich',300,'registration_open',true,'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80'),
 ('Beer POTLA.CH Zurich','beer-potlach-zurich','An informal evening with the community.','Stakeholder demo event. Meet fellow Czech and Slovak professionals in Switzerland.',now()+interval '21 days','Zurich',120,'registration_open',false,'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=1600&q=80'),
 ('Networking Evening Geneva','networking-evening-geneva','Connect with professionals in French-speaking Switzerland.','Stakeholder demo event. A relaxed evening of introductions and conversation.',now()+interval '35 days','Geneva',60,'registration_open',false,'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1600&q=80') on conflict(slug) do nothing;
insert into public.ticket_types(event_id,name,base_price,free_entitlement,discount_entitlement)
 select e.id,'Standard ticket',v.price,v.free,v.discount from (values
 ('annual-symposium-2026',120,'symposium_free_ticket'::text,null::text),
 ('beer-potlach-zurich',30,null,'potlach_discount'),
 ('networking-evening-geneva',20,null,'potlach_discount')) v(slug,price,free,discount)
 join public.events e on e.slug=v.slug where not exists(select 1 from public.ticket_types t where t.event_id=e.id);
commit;
