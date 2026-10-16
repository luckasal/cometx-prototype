import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '../.test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { calculateTicketPrice } from '../src/lib/pricing.ts';

const scenarios = [
  ['guest','symposium',null,{},265,265,'public'],
  ['Fanoušek symposium','symposium','fanousek',{symposium_half_price:50},265,132.5,'percent_discount'],
  ['CometXXL symposium','symposium','cometxxl',{symposium_free_ticket:1},265,0,'free'],
  ['CometXXL regular','regular_event','cometxxl',{other_events_discount:50},30,15,'percent_discount'],
  ['CometXXL workshop','workshop','cometxxl',{workshop_credit:100},265,165,'workshop_credit'],
  ['Ambasador symposium','symposium','ambasador',{symposium_free_ticket:1},265,0,'free'],
  ['Ambasador POTLA.CH','potlach','ambasador',{potlach_free_ticket:1},30,0,'free'],
  ['Ambasador workshop','workshop','ambasador',{workshop_credit:300},265,0,'workshop_credit'],
  ['expired membership','symposium',null,{},265,265,'public'],
  ['Fanoušek workshop','workshop','fanousek',{symposium_half_price:50},265,265,'public'],
  ['POTLA.CH without configured discount','potlach','cometxxl',{other_events_discount:50},30,30,'public'],
];

test('event-category pricing agrees with server SQL quotes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as 'select null::uuid';`);
    // These production-only extensions are absent from the PGlite fixture and
    // unrelated to pricing; exercise ordered schema/pricing migrations only.
    for (const name of (await readdir('drizzle/migrations'))
      .filter(name => name.endsWith('.sql') && ![
        '0016_disable_prototype_membership_grant.sql',
        '0018_event_media_storage.sql',
        '0019_event_owned_speakers.sql',
      ].includes(name)).sort()) {
      await db.exec(await readFile(`drizzle/migrations/${name}`, 'utf8'));
    }
    const officialBenefits=(await db.query(`select p.slug,e.key,pe.value from plan_entitlements pe
      join membership_plans p on p.id=pe.membership_plan_id
      join entitlements e on e.id=pe.entitlement_id
      where p.slug in ('fanousek','cometxxl','ambasador')`)).rows;
    assert.equal(officialBenefits.some(row=>row.key==='potlach_discount'),false);
    assert.equal(Number(officialBenefits.find(row=>row.slug==='ambasador'&&row.key==='workshop_credit')?.value),300);
    for (const [name,eventType,tier,benefits,publicPrice,expected,benefitType] of scenarios) {
      const ticket = {basePrice:publicPrice,currency:'CHF'};
      const client = calculateTicketPrice(ticket,benefits,eventType,tier);
      const sql = (await db.query(`select quote_cometx_ticket($1::numeric,'CHF',null,$2,$3,$4::jsonb,null,null) as quote`,
        [publicPrice,eventType,tier,JSON.stringify(benefits)])).rows[0].quote;
      assert.equal(client.finalPrice,expected,name);
      assert.equal(client.benefitType,benefitType,name);
      assert.equal(Number(sql.final_minor),Math.round(expected*100),`${name} SQL`);
      assert.equal(sql.benefit_type,benefitType,`${name} SQL benefit`);
    }
    const noNegative = calculateTicketPrice({basePrice:30,currency:'CHF'},{workshop_credit:300},'workshop','ambasador');
    assert.equal(noNegative.finalPrice,0);
    const freeWins = calculateTicketPrice({basePrice:30,currency:'CHF',memberPrice:10},
      {potlach_free_ticket:1,potlach_discount:50},'potlach','ambasador');
    assert.equal(freeWins.finalPrice,0);
    const freeSql=(await db.query(`select quote_cometx_ticket(30,'CHF',10,'potlach','ambasador',
      '{"potlach_free_ticket":1,"potlach_discount":50}'::jsonb,null,null) as quote`)).rows[0].quote;
    assert.equal(Number(freeSql.final_minor),0);
    const configuredPotlach = calculateTicketPrice({basePrice:30,currency:'CHF'},
      {potlach_discount:25},'potlach','fanousek');
    assert.equal(configuredPotlach.finalPrice,22.5);
    const fanWorkshop = calculateTicketPrice({basePrice:265,currency:'CHF',discountEntitlement:'other_events_discount'},
      {other_events_discount:50},'workshop','fanousek');
    assert.equal(fanWorkshop.finalPrice,265);
    const fanWorkshopSql=(await db.query(`select quote_cometx_ticket(265,'CHF',null,'workshop','fanousek',
      '{"other_events_discount":50}'::jsonb,null,'other_events_discount') as quote`)).rows[0].quote;
    assert.equal(Number(fanWorkshopSql.final_minor),26500);

    const user = (await db.query(`insert into auth.users(id,email) values(gen_random_uuid(),'pricing-member@example.invalid') returning id`)).rows[0].id;
    const plan = (await db.query(`select id from membership_plans where slug='cometxxl'`)).rows[0].id;
    const discount = (await db.query(`select id from entitlements where key='other_events_discount'`)).rows[0].id;
    await db.query(`insert into plan_entitlements(membership_plan_id,entitlement_id,value)
      values($1,$2,50) on conflict(membership_plan_id,entitlement_id) do update set value=50`,[plan,discount]);
    await db.query(`insert into memberships(user_id,membership_plan_id,status,starts_at,ends_at)
      values($1,$2,'active',now()-interval '1 day',now()+interval '1 year')`,[user,plan]);
    const event = (await db.query(`insert into events(title,slug,start_date,status,event_type,capacity)
      values('Pricing fixture','pricing-fixture',now()+interval '1 year','registration_open','regular_event',100) returning id`)).rows[0].id;
    const ticket = (await db.query(`insert into ticket_types(event_id,name,base_price,capacity)
      values($1,'Standard',30,100) returning id`,[event])).rows[0].id;
    const lines=JSON.stringify([{ticket_id:ticket,quantity:2}]);
    const order=(await db.query(`select begin_ticket_order($1,null,null,$2::jsonb,true) as result`,[user,lines])).rows[0].result;
    assert.equal(Number(order.amount_minor),4500, 'only one of two tickets gets the 50% benefit');
    const stored=(await db.query(`select public_price_minor,benefit_type,benefit_value,membership_tier,
      final_price_minor,amount_minor,quantity from ticket_order_items where order_id=$1
      order by (benefit_type='public'),id`,[order.id])).rows;
    assert.deepEqual(stored.map(line=>[Number(line.public_price_minor),line.benefit_type,Number(line.benefit_value),
      line.membership_tier,Number(line.final_price_minor),Number(line.amount_minor),Number(line.quantity)]),
      [[3000,'percent_discount',50,'cometxxl',1500,1500,1],[3000,'public',0,null,3000,3000,1]]);
    const repeat=(await db.query(`select begin_ticket_order($1,null,null,$2::jsonb,true) as result`,[user,lines])).rows[0].result;
    assert.equal(Number(repeat.amount_minor),6000, 'a pending/paid benefit use reserves the member\'s one ticket for this event');

    const splitEvent = (await db.query(`insert into events(title,slug,start_date,status,event_type,capacity)
      values('Split pricing fixture','split-pricing-fixture',now()+interval '1 year','registration_open','regular_event',100) returning id`)).rows[0].id;
    const splitTicket = (await db.query(`insert into ticket_types(event_id,name,base_price,capacity)
      values($1,'Standard',30,100) returning id`,[splitEvent])).rows[0].id;
    const attendees = [{firstName:'Member',lastName:'One'},{firstName:'Guest',lastName:'Two'}];
    const batchInput = [{eventSlug:'split-pricing-fixture',lines:[{ticketId:splitTicket,quantity:2,attendees}]}];
    const batch = (await db.query(`select begin_ticket_checkout_batch($1,null,null,$2::jsonb,true,true,null,null) as result`,
      [user,JSON.stringify(batchInput)])).rows[0].result;
    assert.equal(Number(batch.amount_minor),4500);
    const splitRows = (await db.query(`select quantity,benefit_type,attendee_details from ticket_order_items
      where order_id=$1 order by (benefit_type='public'),id`,[batch.order_id])).rows;
    assert.deepEqual(splitRows.map(row=>[Number(row.quantity),row.benefit_type,row.attendee_details.length]),
      [[1,'percent_discount',1],[1,'public',1]], 'attendee details are split alongside the Stripe prices');
    assert.deepEqual((await db.query(`select first_name,last_name from ticket_order_attendees where order_id=$1 order by position`,
      [batch.order_id])).rows,[{first_name:'Member',last_name:'One'},{first_name:'Guest',last_name:'Two'}]);

    await db.query(`update memberships set ends_at=now()-interval '1 minute' where user_id=$1`,[user]);
    const secondEvent = (await db.query(`insert into events(title,slug,start_date,status,event_type,capacity)
      values('Second pricing fixture','second-pricing-fixture',now()+interval '1 year','registration_open','regular_event',100) returning id`)).rows[0].id;
    const secondTicket = (await db.query(`insert into ticket_types(event_id,name,base_price,capacity)
      values($1,'Standard',30,100) returning id`,[secondEvent])).rows[0].id;
    const expired=(await db.query(`select begin_ticket_order($1,null,null,$2::jsonb,true) as result`,[user,JSON.stringify([{ticket_id:secondTicket,quantity:2}])])).rows[0].result;
    assert.equal(Number(expired.amount_minor),6000);
    const expiredLine=(await db.query(`select benefit_type,membership_tier from ticket_order_items where order_id=$1`,[expired.id])).rows[0];
    assert.equal(expiredLine.benefit_type,'public');
    assert.equal(expiredLine.membership_tier,null);
    await db.query(`update ticket_types set required_entitlement='symposium_free_ticket' where id=$1`,[secondTicket]);
    await assert.rejects(db.query(`select begin_ticket_order(null,'Guest Buyer','guest@example.invalid',$1::jsonb,true,$2,$3)`,
      [JSON.stringify([{ticket_id:secondTicket,quantity:1}]),'a'.repeat(64),'b'.repeat(64)]),
      /requires its listed CometX membership benefit/, 'server rejects a guest even when the event remains public');
    await assert.rejects(db.query(`select begin_ticket_order($1,null,null,$2::jsonb,true)`,
      [user,JSON.stringify([{ticket_id:secondTicket,quantity:1}])]),
      /requires its listed CometX membership benefit/, 'expired membership cannot buy a restricted ticket');
  } finally { await db.close(); }
});
