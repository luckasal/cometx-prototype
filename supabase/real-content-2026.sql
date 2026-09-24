-- Official CometX membership and event content captured from cs.cometx.ch on 2026-09-24.
-- Repeatable: safe to run more than once.
begin;

insert into public.entitlements (key, name, description) values
  ('member_content', 'Přednášky, videa, rozhovory a články', 'Exkluzivní přístup do speciální členské sekce webu.'),
  ('community_membership', 'Členství v komunitě', 'Přístup do komunity CometX.'),
  ('symposium_half_price', 'Sleva 50 % na SCAS Symposium', 'Poloviční cena vstupenky na nadcházející symposium.'),
  ('symposium_free_ticket', 'Vstup zdarma na SCAS', 'Vstup zdarma na nadcházející Slovak and Czech Annual Symposium.'),
  ('other_events_discount', 'Sleva 50 % na další akce', 'Sleva na všechny další akce CometX mimo workshopy.'),
  ('potlach_free_ticket', 'Pivní POTLA.CH zdarma', 'Vstup zdarma na všechny Pivní POTLA.CH akce.'),
  ('workshop_credit', 'Workshopový kupón', 'Kupón použitelný na jakýkoliv workshop CometX.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.membership_plans (name, slug, description, annual_price, currency, sort_order, active) values
  ('Fanoušek', 'fanousek', 'Užijte si online obsah a největší networkingovou akci pro Čechy a Slováky ve Švýcarsku.', 90, 'CHF', 1, true),
  ('CometXXL', 'cometxxl', 'Kompletní ochutnávka všeho, co tvoříme. S balíkem CometXXL budete u těch nejdůležitějších momentů.', 250, 'CHF', 2, true),
  ('Ambasador', 'ambasador', 'Jako ambasador můžete dál šířit myšlenku, že networking pomáhá, a být u všeho, co CometX dělá.', 599, 'CHF', 3, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  annual_price = excluded.annual_price,
  currency = excluded.currency,
  sort_order = excluded.sort_order,
  active = excluded.active;

delete from public.plan_entitlements
where membership_plan_id in (
  select id from public.membership_plans where slug in ('fanousek', 'cometxxl', 'ambasador')
);

insert into public.plan_entitlements (membership_plan_id, entitlement_id, value)
select p.id, e.id, x.value
from (values
  ('fanousek', 'member_content', 1::numeric),
  ('fanousek', 'symposium_half_price', 50::numeric),
  ('fanousek', 'community_membership', 1::numeric),
  ('cometxxl', 'member_content', 1::numeric),
  ('cometxxl', 'symposium_free_ticket', 1::numeric),
  ('cometxxl', 'other_events_discount', 50::numeric),
  ('cometxxl', 'workshop_credit', 100::numeric),
  ('cometxxl', 'community_membership', 1::numeric),
  ('ambasador', 'member_content', 1::numeric),
  ('ambasador', 'symposium_free_ticket', 1::numeric),
  ('ambasador', 'potlach_free_ticket', 1::numeric),
  ('ambasador', 'workshop_credit', 300::numeric),
  ('ambasador', 'community_membership', 1::numeric)
) as x(plan_slug, entitlement_key, value)
join public.membership_plans p on p.slug = x.plan_slug
join public.entitlements e on e.key = x.entitlement_key;

insert into public.events
  (title, slug, short_description, description, start_date, venue, address, status, featured, hero_image_url)
values
  (
    'Emoční regulace v každodenní praxi',
    'emocni-regulace-v-kazdodenni-praxi',
    'Praktický workshop zaměřený na zvládání emocí v každodenním životě.',
    'Exkluzivní příležitost k seberozvoji v malé skupině podobně smýšlejících lidí. Praktické téma vedené odborníkem z Česka nebo Slovenska.',
    '2026-10-17 14:00:00+02',
    'Altstadthaus Quartiertreff',
    'Obmannamtsgasse 15, 8001 Zürich, Switzerland',
    'registration_open',
    false,
    '/assets/cometx/emotional-regulation.jpg'
  ),
  (
    'Co AI nevyřeší',
    'co-ai-nevyresi',
    'Diskuse o tom, kde umělá inteligence končí a kde zůstává nenahraditelný člověk.',
    'Tematická CometX akce s odbornou diskusí, hlubším pohledem na současné téma a prostorem pro networking a sdílení zkušeností.',
    '2027-01-15 14:00:00+01',
    'Zurich – přesné místo bude upřesněno',
    null,
    'registration_open',
    false,
    '/assets/cometx/ai-workshop.jpeg'
  ),
  (
    'Jak řešit konflikty s toxickými osobnostmi',
    'jak-resit-konflikty-s-toxickymi-osobnostmi',
    'Praktický workshop pro náročné konfliktní situace v práci i osobním životě.',
    'Exkluzivní příležitost k seberozvoji v malé skupině. Zaměření na komunikaci, duševní zdraví a praktické soft skills.',
    '2027-03-11 18:00:00+01',
    'Zurich – přesné místo bude upřesněno',
    null,
    'registration_open',
    false,
    '/assets/cometx/conflict-workshop.jpg'
  )
on conflict (slug) do update set
  title = excluded.title,
  short_description = excluded.short_description,
  description = excluded.description,
  start_date = excluded.start_date,
  venue = excluded.venue,
  address = excluded.address,
  status = excluded.status,
  featured = excluded.featured,
  hero_image_url = excluded.hero_image_url;

-- Remove the two invented stakeholder-demo listings now replaced by official events.
delete from public.events where slug in ('beer-potlach-zurich', 'networking-evening-geneva');

commit;
