-- Tighten article reads: only fully public articles are readable directly.
-- Gated articles are served by server functions after entitlement checks.
drop policy "articles public read" on public.articles;
create policy "articles public read" on public.articles for select to anon, authenticated
  using ((status = 'published' and visibility = 'public') or public.is_admin());

-- ============ ENTITLEMENTS ============
insert into public.entitlements (key, name, description) values
  ('premium_content','Premium content','Access to member-only articles and recordings'),
  ('symposium_free_ticket','Symposium included','Annual Symposium standard ticket included'),
  ('potlach_discount','POTLA.CH discount','Percentage discount on Beer POTLA.CH tickets'),
  ('workshop_credit','Workshop credit','Annual credit towards workshops (CHF)'),
  ('priority_registration','Priority registration','Early access to event registration'),
  ('ambassador_content','Ambassador content','Ambassador-only briefings and strategy notes');

-- ============ PLANS ============
insert into public.membership_plans (name, slug, description, annual_price, currency, active, sort_order) values
  ('Fanousek','fanousek','For people who want to stay close to the community: member pricing on every event and access to premium stories.',60,'CHF',true,1),
  ('CometXXL','cometxxl','The full membership. Annual Symposium included, half-price POTLA.CH and a yearly workshop credit.',240,'CHF',true,2),
  ('Ambasador','ambasador','For those who carry CometX forward: everything in CometXXL plus ambassador briefings and priority registration.',480,'CHF',true,3);

insert into public.plan_entitlements (membership_plan_id, entitlement_id, value)
select p.id, e.id, v.value from (values
  ('fanousek','premium_content',null::numeric),
  ('fanousek','potlach_discount',20),
  ('cometxxl','premium_content',null),
  ('cometxxl','symposium_free_ticket',1),
  ('cometxxl','potlach_discount',50),
  ('cometxxl','workshop_credit',100),
  ('ambasador','premium_content',null),
  ('ambasador','symposium_free_ticket',1),
  ('ambasador','potlach_discount',50),
  ('ambasador','workshop_credit',200),
  ('ambasador','priority_registration',1),
  ('ambasador','ambassador_content',null)
) as v(plan_slug, ent_key, value)
join public.membership_plans p on p.slug = v.plan_slug
join public.entitlements e on e.key = v.ent_key;

-- ============ SPEAKERS ============
insert into public.speakers (name, slug, job_title, company, bio, photo_url, linkedin_url) values
  ('Lucia Hrabalova','lucia-hrabalova','Head of Data Platform','Helvetia Data Works','Lucia moved from Brno to Zurich in 2016 and now leads a platform team of thirty engineers. She writes about the unglamorous parts of scaling data teams.','https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80','https://www.linkedin.com/'),
  ('Tomas Bednar','tomas-bednar','Founder','Basel Robotics Lab','Tomas builds inspection robots for the pharma industry and has hired more than forty people out of the Czech and Slovak diaspora.','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80','https://www.linkedin.com/'),
  ('Petra Nova','petra-nova','Partner','Leman Ventures','Petra invests in early stage European deep tech and spends a lot of her time explaining term sheets to first time founders.','https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&q=80','https://www.linkedin.com/'),
  ('Marek Svoboda','marek-svoboda','Principal Engineer','Geneva Fintech Group','Marek has spent a decade on payment infrastructure and is unreasonably enthusiastic about idempotency keys.','https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=80','https://www.linkedin.com/'),
  ('Katarina Dolna','katarina-dolna','Clinical Research Lead','Zug Biosciences','Katarina coordinates multi-country trials and mentors researchers who are relocating to Switzerland for the first time.','https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80','https://www.linkedin.com/'),
  ('Jan Kriz','jan-kriz','Design Director','Studio Nordost','Jan runs a small design studio in Lausanne and has art-directed the last three CometX symposium identities.','https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&q=80','https://www.linkedin.com/');

-- ============ PARTNERS ============
insert into public.partners (name, website_url, description, tier, active, logo_url) values
  ('Helvetia Data Works','https://example.com','Swiss data engineering consultancy and long-term symposium partner.','Main partner',true,null),
  ('Leman Ventures','https://example.com','Early stage fund backing founders across the DACH region.','Gold',true,null),
  ('Basel Robotics Lab','https://example.com','Industrial robotics research and product lab.','Gold',true,null),
  ('Zug Biosciences','https://example.com','Clinical research organisation with offices in Zug and Prague.','Silver',true,null),
  ('Studio Nordost','https://example.com','Brand and editorial design studio based in Lausanne.','Community',true,null);

-- ============ EVENTS ============
insert into public.events (title, slug, short_description, description, hero_image_url, start_date, end_date, venue, address, capacity, registration_start, registration_end, status, featured) values
  ('CometX Annual Symposium 2026','annual-symposium-2026',
   'One day, three stages and the full CometX community in one room in Zurich.',
   E'The Annual Symposium is the centre of the CometX year. Expect a main stage with talks on careers, technology and the practicalities of building a life between two countries, a workshop floor, and a long evening of conversations that usually outlast the venue booking.\n\nThe day is built around three questions: what is changing in our industries, what does it take to grow into leadership here, and how do we keep the community useful to people who arrived last month.',
   'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80',
   '2026-09-11 09:00:00+02', '2026-09-11 23:00:00+02',
   'UZH Zürich, Irchel Campus','Winterthurerstrasse 190, 8057 Zürich, Switzerland', 320,
   '2026-03-01 00:00:00+01', '2026-09-11 09:00:00+02','completed', true),
  ('Beer POTLA.CH Zurich','beer-potlach-zurich',
   'Our recurring informal evening: good beer, no name tags, no pitch decks.',
   E'POTLA.CH is the easiest way into the community. No programme, no panel, just a reserved room and a few hundred people who moved here for similar reasons.\n\nMembers get a discounted ticket, everyone else is very welcome at the standard price.',
   'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=1600&q=80',
   now() + interval '21 days', now() + interval '21 days' + interval '5 hours',
   'Brauerei Hall','Langstrasse 84, 8004 Zurich', 120,
   now() - interval '20 days', now() + interval '20 days','registration_open', false),
  ('Networking Evening Geneva','networking-evening-geneva',
   'A smaller, quieter format for the French-speaking part of the community.',
   E'An evening for people working in and around Geneva and Lausanne. Short introductions, then open conversation. We keep the group small on purpose.',
   'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1600&q=80',
   now() + interval '35 days', now() + interval '35 days' + interval '4 hours',
   'Maison Verte','Rue du Rhone 12, 1204 Geneva', 60,
   now() - interval '5 days', now() + interval '33 days','registration_open', false),
  ('CometX Annual Symposium 2025','annual-symposium-2025',
   'Last year in Bern: 240 people, 14 speakers and a very long afterparty.',
   'The 2025 edition brought the community to Bern for the first time. Recordings are available to members in the community section.',
   'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1600&q=80',
   now() - interval '300 days', now() - interval '300 days' + interval '10 hours',
   'Progr Bern','Speichergasse 4, 3011 Bern', 240,
   now() - interval '360 days', now() - interval '305 days','completed', false);

insert into public.event_speakers (event_id, speaker_id, sort_order)
select e.id, s.id, v.ord from (values
  ('annual-symposium-2026','lucia-hrabalova',1),
  ('annual-symposium-2026','tomas-bednar',2),
  ('annual-symposium-2026','petra-nova',3),
  ('annual-symposium-2026','marek-svoboda',4),
  ('networking-evening-geneva','katarina-dolna',1),
  ('beer-potlach-zurich','jan-kriz',1)
) as v(event_slug, speaker_slug, ord)
join public.events e on e.slug = v.event_slug
join public.speakers s on s.slug = v.speaker_slug;

insert into public.event_partners (event_id, partner_id)
select e.id, p.id from public.events e join public.partners p on p.name in ('Helvetia Data Works','Leman Ventures','Studio Nordost')
where e.slug = 'annual-symposium-2026';

-- ============ WORKSHOPS ============
insert into public.workshops (event_id, speaker_id, title, description, start_time, end_time, location, capacity, base_price, separate_registration_required)
select e.id, s.id, v.title, v.descr, e.start_date + v.offs, e.start_date + v.offs + interval '90 minutes', v.loc, v.cap, v.price, true
from (values
  ('annual-symposium-2026','lucia-hrabalova','Scaling a data team without scaling the chaos','A practical session on hiring, on-call and the first fifty dashboards.', interval '3 hours','Workshop Room A',30,80::numeric),
  ('annual-symposium-2026','petra-nova','Reading your first term sheet','Line by line through a realistic seed term sheet, with the traps marked.', interval '5 hours','Workshop Room B',25,120::numeric),
  ('annual-symposium-2026','marek-svoboda','Payments infrastructure for people who do not build payments','What actually happens between a click and a settled transaction.', interval '7 hours','Workshop Room A',30,80::numeric)
) as v(event_slug, speaker_slug, title, descr, offs, loc, cap, price)
join public.events e on e.slug = v.event_slug
join public.speakers s on s.slug = v.speaker_slug;

-- ============ TICKET TYPES ============
insert into public.ticket_types (event_id, name, description, base_price, currency, capacity, active, required_entitlement, discount_entitlement, free_entitlement, sort_order)
select e.id, v.name, v.descr, v.price, 'CHF', v.cap, true, v.req, v.disc, v.free, v.ord
from (values
  ('annual-symposium-2026','Annual Symposium Standard','Full day access, lunch and evening reception.',120::numeric,300,null::text,null::text,'symposium_free_ticket'::text,1),
  ('annual-symposium-2026','Annual Symposium Supporter','Standard access plus a supporter contribution to the community fund.',220::numeric,50,null,null,null,2),
  ('beer-potlach-zurich','POTLA.CH Entry','Entry and the first drink.',30::numeric,120,null,'potlach_discount',null,1),
  ('networking-evening-geneva','Networking Evening','Entry, drinks and snacks.',20::numeric,60,null,'potlach_discount',null,1),
  ('annual-symposium-2025','Standard ticket','Archive ticket type.',110::numeric,240,null,null,null,1)
) as v(event_slug, name, descr, price, cap, req, disc, free, ord)
join public.events e on e.slug = v.event_slug;

-- ============ ARTICLES ============
insert into public.articles (title, slug, excerpt, body, hero_image_url, published_at, status, visibility, required_entitlement) values
  ('What CometX is, and what it is not','what-cometx-is',
   'A short note on why a few hundred people keep showing up to the same events.',
   E'CometX started as a mailing list between six people who had all moved to Switzerland within the same year. It is now a few thousand names, three recurring event formats and a membership that pays for the rooms.\n\nWe are not a chamber of commerce and not a relocation agency. What we do is simpler: we keep a calendar, we keep the room booked, and we make sure that the person who arrived last month can talk to the person who arrived ten years ago.\n\nEverything else - the symposium, the workshops, the partner programme - grew out of that one habit.',
   'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&q=80', now() - interval '20 days','published','public', null),
  ('Salary bands in Swiss tech, honestly','salary-bands-swiss-tech',
   'What 180 members told us about pay, levels and the gap between Zurich and Geneva.',
   E'This is the members-only version of our annual pay survey. 180 people answered, across engineering, life sciences, finance and design.\n\nThe headline: the median engineering package in Zurich sits meaningfully above Geneva for the same level, and the gap widens at senior levels rather than narrowing. Bonus structures vary far more than base pay, and equity remains rare outside a small number of companies.\n\nWe also asked how many people negotiated their first Swiss offer. Just under a third did. Of those who did, the median increase was around six percent - which over a decade is the difference between one apartment and another.\n\nThe full breakdown by level, canton and industry follows below, together with the raw distribution for each band.',
   'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&q=80', now() - interval '12 days','published','members','premium_content'),
  ('Notes from the 2025 Symposium','notes-2025-symposium',
   'Fourteen speakers, one very long day, and the three things people kept repeating.',
   E'A recap of the Bern edition, with the sessions worth rewatching and the questions that came up in every hallway conversation.\n\nRecordings are linked at the bottom for members.',
   'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=1600&q=80', now() - interval '60 days','published','registered', null),
  ('Ambassador briefing: the 2026 partner strategy','ambassador-briefing-2026',
   'How we plan to fund the next symposium without turning the stage into an advertising slot.',
   E'This briefing is for ambassadors. It covers the partner tiers we are introducing, the revenue split between membership and partnership, and the editorial rules we want to hold ourselves to.\n\nThe short version: partnership should never buy stage time. It buys the room, the recording and the coffee.',
   'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1600&q=80', now() - interval '5 days','published','entitlement','ambassador_content');
