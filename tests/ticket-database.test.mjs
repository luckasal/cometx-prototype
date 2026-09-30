import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
// Isolated runtime avoids changing the application's pnpm dependency graph.
// npm install --prefix .test-runtime --no-save --package-lock=false @electric-sql/pglite
import { PGlite } from '../.test-runtime/node_modules/@electric-sql/pglite/dist/index.js';

test('ticket migrations, guest separation, fulfillment replay and mixed capacity', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as 'select null::uuid';`);
    for (const name of (await readdir('drizzle/migrations')).filter(n => n.endsWith('.sql')).sort()) {
      await db.exec(await readFile(`drizzle/migrations/${name}`, 'utf8'));
    }
    const event = (await db.query(`insert into events(title,slug,start_date,status,capacity)
      values('TEST fixture','test-fixture',now()+interval '1 year','registration_open',100) returning id`)).rows[0].id;
    const tickets = (await db.query(`insert into ticket_types(event_id,name,base_price,capacity)
      values($1,'TEST A',10,10),($1,'TEST B',20,10) returning id`, [event])).rows;
    const otherEvent = (await db.query(`insert into events(title,slug,start_date,status,capacity)
      values('Other TEST fixture','other-test-fixture',now()+interval '1 year','registration_open',100) returning id`)).rows[0].id;
    const otherTicket = (await db.query(`insert into ticket_types(event_id,name,base_price,capacity)
      values($1,'TEST other',10,10) returning id`, [otherEvent])).rows[0].id;
    await assert.rejects(db.query(`select begin_ticket_order(null,'Test Buyer','test@example.invalid',$1::jsonb,true,$2,$3)`,
      [JSON.stringify([{ticket_id:tickets[0].id,quantity:1},{ticket_id:otherTicket,quantity:1}]), 'a'.repeat(64), 'b'.repeat(64)]), /unavailable/);
    assert.equal((await db.query('select count(*)::int as n from ticket_orders')).rows[0].n, 0);
    async function order() {
      return (await db.query(`select begin_ticket_order(null,'Test Buyer','test@example.invalid',$1::jsonb,true,$2,$3) as result`,
        [JSON.stringify(tickets.map(t => ({ticket_id:t.id,quantity:2}))), 'a'.repeat(64),'b'.repeat(64)])).rows[0].result;
    }
    async function fulfill(o, id) {
      await db.query(`select apply_ticket_order_event('checkout.session.completed',$1::jsonb)`, [JSON.stringify({id,livemode:false,amount_total:6000,currency:'chf',payment_status:'paid',payment_intent:`pi_${id}`,metadata:{order_id:o.id}})]);
    }
    const first = await order();
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,0);
    assert.equal((await db.query("select count(*)::int as n from contacts where email='test@example.invalid' and member_id is null")).rows[0].n,1);
    await fulfill(first,'cs_test_first');
    await fulfill(first,'cs_test_first');
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees')).rows[0].n,4);
    const second = await order();
    await db.query('update ticket_types set capacity=2 where id=$1',[tickets[1].id]);
    await fulfill(second,'cs_test_second');
    assert.equal((await db.query('select status from ticket_orders where id=$1',[second.id])).rows[0].status,'manual_review');
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1',[second.id])).rows[0].n,0);
    await db.query('update ticket_types set capacity=20 where event_id=$1',[event]);
    const failed = await order();
    const failedSession = {id:'cs_test_failed',livemode:false,amount_total:6000,currency:'chf',payment_status:'unpaid',metadata:{order_id:failed.id}};
    await db.query(`select apply_ticket_order_event('checkout.session.async_payment_failed',$1::jsonb)`,[JSON.stringify(failedSession)]);
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1',[failed.id])).rows[0].n,0);
    const expired = await order();
    await db.query(`select apply_ticket_order_event('checkout.session.expired',$1::jsonb)`,[JSON.stringify({...failedSession,id:'cs_test_expired',metadata:{order_id:expired.id}})]);
    assert.equal((await db.query('select status from ticket_orders where id=$1',[expired.id])).rows[0].status,'expired');
    const invalid = await order();
    await assert.rejects(db.query(`select apply_ticket_order_event('checkout.session.completed',$1::jsonb)`,[JSON.stringify({...failedSession,id:'cs_test_tampered',amount_total:1,payment_status:'paid',metadata:{order_id:invalid.id}})]),/does not match/);
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1',[invalid.id])).rows[0].n,0);
    await db.query('select fail_unstarted_ticket_order($1)',[invalid.id]);
    await db.query('update ticket_types set base_price=0 where event_id=$1',[event]);
    const free = await order();
    assert.equal(free.status,'free');
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1',[free.id])).rows[0].n,4);
    await db.query('update ticket_types set base_price=case when id=$1 then 10 else 20 end,capacity=100 where event_id=$2',[tickets[0].id,event]);
    const batchEvents = [
      {eventSlug:'test-fixture',lines:[
        {ticketId:tickets[0].id,quantity:1,attendees:[{firstName:'Alice',lastName:'Guest'}]},
        {ticketId:tickets[1].id,quantity:2,attendees:[{firstName:'Bob',lastName:'Guest'},{firstName:'Bea',lastName:'Guest'}]},
      ]},
      {eventSlug:'other-test-fixture',lines:[{ticketId:otherTicket,quantity:1,attendees:[{firstName:'Casey',lastName:'Guest'}]}]},
    ];
    const batch = (await db.query(`select begin_ticket_checkout_batch(null,'Order Buyer','test@example.invalid',$1::jsonb,true,true,$2,$3) as result`,
      [JSON.stringify(batchEvents),'c'.repeat(64),'d'.repeat(64)])).rows[0].result;
    assert.equal(batch.status,'pending');
    assert.equal(batch.amount_minor,6000);
    assert.equal(batch.order_ids.length,1);
    assert.equal(batch.order_id,batch.order_ids[0]);
    assert.equal((await db.query('select count(*)::int as n from ticket_orders where checkout_batch_id=$1',[batch.id])).rows[0].n,1);
    assert.equal((await db.query('select count(distinct event_id)::int as n from ticket_order_items where order_id=$1',[batch.order_id])).rows[0].n,2);
    assert.equal((await db.query('select count(*)::int as n from ticket_order_items where order_id=$1',[batch.order_id])).rows[0].n,3);
    assert.equal((await db.query('select count(*)::int as n from ticket_order_attendees where order_id=$1',[batch.order_id])).rows[0].n,4);
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=any($1::uuid[])',[batch.order_ids])).rows[0].n,0);
    await db.query('select save_ticket_checkout_batch_session($1,$2)',[batch.id,'cs_test_batch']);
    const batchSession={id:'cs_test_batch',livemode:false,amount_total:6000,currency:'chf',payment_status:'paid',payment_intent:'pi_batch',customer:'cus_batch',metadata:{batch_id:batch.id,order_id:batch.order_id}};
    await db.query(`select apply_ticket_checkout_batch_event('checkout.session.completed',$1::jsonb)`,[JSON.stringify(batchSession)]);
    await db.query(`select apply_ticket_checkout_batch_event('checkout.session.completed',$1::jsonb)`,[JSON.stringify(batchSession)]);
    const issued = (await db.query('select a.attendee_name,a.attendee_first_name,a.attendee_last_name,a.attendee_email from ticket_attendees a where a.order_id=any($1::uuid[]) order by a.attendee_name',[batch.order_ids])).rows;
    assert.deepEqual(issued.map(x=>x.attendee_name),['Alice Guest','Bea Guest','Bob Guest','Casey Guest']);
    assert.ok(issued.every(x=>x.attendee_email==='test@example.invalid'));
    assert.deepEqual(issued.map(x=>[x.attendee_first_name,x.attendee_last_name]),[['Alice','Guest'],['Bea','Guest'],['Bob','Guest'],['Casey','Guest']]);
    assert.deepEqual((await db.query('select distinct event_id from ticket_attendees where order_id=$1',[batch.order_id])).rows.map(x=>x.event_id).sort(),[event,otherEvent].sort());
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1',[batch.order_id])).rows[0].n,4);
    assert.equal((await db.query('select count(distinct order_attendee_id)::int as n from ticket_attendees where order_id=$1',[batch.order_id])).rows[0].n,4);
    assert.equal((await db.query('select status from ticket_checkout_batches where id=$1',[batch.id])).rows[0].status,'confirmed');
    assert.equal((await db.query('select count(*)::int as n from payments where checkout_batch_id=$1 and status=\'paid\'',[batch.id])).rows[0].n,1);
    assert.equal(Number((await db.query('select sum(amount)::numeric as n from payments where checkout_batch_id=$1',[batch.id])).rows[0].n),60);
    const guestAccount=(await db.query("insert into auth.users(id,email) values(gen_random_uuid(),'test@example.invalid') returning id")).rows[0].id;
    assert.equal((await db.query('select claim_guest_ticket_order($1,$2,$3) as claimed',[batch.order_id,'c'.repeat(64),guestAccount])).rows[0].claimed,true);
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1 and user_id=$2',[batch.order_id,guestAccount])).rows[0].n,4);
    assert.equal((await db.query('select count(*)::int as n from memberships where user_id=$1',[guestAccount])).rows[0].n,0);
    const userId=(await db.query("insert into auth.users(id,email) values(gen_random_uuid(),'member@example.invalid') returning id")).rows[0].id;
    const planId=(await db.query("insert into membership_plans(name,slug) values('TEST plan','test-plan') returning id")).rows[0].id;
    await db.query("insert into memberships(user_id,membership_plan_id,status) values($1,$2,'active')",[userId,planId]);
    const entitlementId=(await db.query("insert into entitlements(key,name) values('test_free_ticket','TEST free ticket') returning id")).rows[0].id;
    await db.query('insert into plan_entitlements(membership_plan_id,entitlement_id,value) values($1,$2,1)',[planId,entitlementId]);
    await db.query('update ticket_types set member_price=5 where id=$1',[tickets[0].id]);
    await db.query("update ticket_types set free_entitlement='test_free_ticket' where id=$1",[otherTicket]);
    const memberEvents=[
      {eventSlug:'test-fixture',lines:[{ticketId:tickets[0].id,quantity:2,attendees:[{firstName:'Member',lastName:'One'},{firstName:'Member',lastName:'Two'}]}]},
      {eventSlug:'other-test-fixture',lines:[{ticketId:otherTicket,quantity:1,attendees:[{firstName:'Free',lastName:'Guest'}]}]},
    ];
    const memberBatch=(await db.query(`select begin_ticket_checkout_batch($1,null,null,$2::jsonb,true,true) as result`,[userId,JSON.stringify(memberEvents)])).rows[0].result;
    assert.equal(memberBatch.amount_minor,1000);
    assert.equal((await db.query('select count(*)::int as n from ticket_orders where checkout_batch_id=$1',[memberBatch.id])).rows[0].n,1);
    assert.deepEqual((await db.query('select price_basis,unit_amount_minor from ticket_order_items where order_id=$1 order by unit_amount_minor',[memberBatch.order_id])).rows.map(x=>[x.price_basis,Number(x.unit_amount_minor)]),[['entitlement_free',0],['member',500]]);
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1',[memberBatch.order_id])).rows[0].n,0);
    await db.query('select save_ticket_checkout_batch_session($1,$2)',[memberBatch.id,'cs_test_member']);
    const memberSession={id:'cs_test_member',livemode:false,amount_total:1000,currency:'chf',payment_status:'paid',payment_intent:'pi_member',metadata:{batch_id:memberBatch.id,order_id:memberBatch.order_id}};
    await db.query(`select apply_ticket_checkout_batch_event('checkout.session.completed',$1::jsonb)`,[JSON.stringify(memberSession)]);
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1',[memberBatch.order_id])).rows[0].n,3);
    assert.equal((await db.query('select count(*)::int as n from payments where order_id=$1 and status=\'paid\'',[memberBatch.order_id])).rows[0].n,1);
    const held=(await db.query(`select begin_ticket_checkout_batch(null,'Race Buyer','race@example.invalid',$1::jsonb,true,true,$2,$3) as result`,
      [JSON.stringify([{eventSlug:'other-test-fixture',lines:[{ticketId:otherTicket,quantity:1,attendees:[{firstName:'Race',lastName:'Buyer'}]}]},{eventSlug:'test-fixture',lines:[{ticketId:tickets[1].id,quantity:1,attendees:[{firstName:'Second',lastName:'Event'}]}]}]),'e'.repeat(64),'f'.repeat(64)])).rows[0].result;
    assert.equal(held.status,'pending');
    await db.query('select save_ticket_checkout_batch_session($1,$2)',[held.id,'cs_test_race']);
    await db.query('update ticket_types set capacity=1 where id=$1',[otherTicket]);
    const raceSession={id:'cs_test_race',livemode:false,amount_total:3000,currency:'chf',payment_status:'paid',payment_intent:'pi_race',metadata:{batch_id:held.id,order_id:held.order_id}};
    await db.query(`select apply_ticket_checkout_batch_event('checkout.session.completed',$1::jsonb)`,[JSON.stringify(raceSession)]);
    assert.equal((await db.query('select status from ticket_orders where id=$1',[held.order_id])).rows[0].status,'manual_review');
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1',[held.order_id])).rows[0].n,0);
    assert.equal((await db.query('select status from payments where order_id=$1',[held.order_id])).rows[0].status,'paid');
    await db.query('update ticket_types set capacity=2 where id=$1',[otherTicket]);
    const beforeRejected=(await db.query('select count(*)::int as n from ticket_orders')).rows[0].n;
    await assert.rejects(db.query(`select begin_ticket_checkout_batch(null,'No Places','full@example.invalid',$1::jsonb,true,true,$2,$3)`,
      [JSON.stringify([{eventSlug:'other-test-fixture',lines:[{ticketId:otherTicket,quantity:1,attendees:[{firstName:'No',lastName:'Place'}]}]},{eventSlug:'test-fixture',lines:[{ticketId:tickets[0].id,quantity:1,attendees:[{firstName:'Other',lastName:'Event'}]}]}]),'g'.repeat(64),'h'.repeat(64)]),/Not enough/);
    assert.equal((await db.query('select count(*)::int as n from ticket_orders')).rows[0].n,beforeRejected);
    await db.query('update ticket_types set capacity=100 where id=$1',[otherTicket]);
    const failedBatch=(await db.query(`select begin_ticket_checkout_batch(null,'Failed Buyer','failed@example.invalid',$1::jsonb,true,true,$2,$3) as result`,
      [JSON.stringify(batchEvents),'i'.repeat(64),'j'.repeat(64)])).rows[0].result;
    await db.query('select save_ticket_checkout_batch_session($1,$2)',[failedBatch.id,'cs_test_failed_batch']);
    await db.query(`select apply_ticket_checkout_batch_event('checkout.session.async_payment_failed',$1::jsonb)`,[JSON.stringify({id:'cs_test_failed_batch',livemode:false,amount_total:6000,currency:'chf',payment_status:'unpaid',metadata:{batch_id:failedBatch.id,order_id:failedBatch.order_id}})]);
    assert.equal((await db.query('select status from ticket_orders where id=$1',[failedBatch.order_id])).rows[0].status,'failed');
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1',[failedBatch.order_id])).rows[0].n,0);
    const freeEvents=[{eventSlug:'other-test-fixture',lines:[{ticketId:otherTicket,quantity:1,attendees:[{firstName:'Free',lastName:'First'}]}]}];
    await db.query('update ticket_types set base_price=0 where id=$1',[otherTicket]);
    const freeBatch=(await db.query(`select begin_ticket_checkout_batch(null,'Free Buyer','free@example.invalid',$1::jsonb,true,false,$2,$3) as result`,
      [JSON.stringify(freeEvents),'k'.repeat(64),'l'.repeat(64)])).rows[0].result;
    assert.equal(freeBatch.status,'free');
    assert.deepEqual((await db.query('select attendee_first_name,attendee_last_name,event_id from ticket_attendees where order_id=$1',[freeBatch.order_id])).rows.map(x=>[x.attendee_first_name,x.attendee_last_name,x.event_id]),[['Free','First',otherEvent]]);
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=$1 and order_attendee_id is not null',[freeBatch.order_id])).rows[0].n,1);
    await db.query('update ticket_types set base_price=10 where id=$1',[otherTicket]);
    const historical=(await db.query(`select begin_ticket_checkout_batch_legacy(null,'Legacy Buyer','legacy@example.invalid',$1::jsonb,true,true,$2,$3) as result`,
      [JSON.stringify(batchEvents),'m'.repeat(64),'n'.repeat(64)])).rows[0].result;
    assert.equal(historical.order_ids.length,2);
    await db.query('select save_ticket_checkout_batch_session($1,$2)',[historical.id,'cs_test_historical']);
    await db.query(`select apply_ticket_checkout_batch_event('checkout.session.completed',$1::jsonb)`,[JSON.stringify({id:'cs_test_historical',livemode:false,amount_total:6000,currency:'chf',payment_status:'paid',payment_intent:'pi_historical',metadata:{batch_id:historical.id}})]);
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=any($1::uuid[])',[historical.order_ids])).rows[0].n,4);
    for (const role of ['anon','authenticated']) {
      assert.equal((await db.query(`select has_function_privilege($1,'public.begin_ticket_order(uuid,text,text,jsonb,boolean,text,text)','EXECUTE') as allowed`,[role])).rows[0].allowed,false);
      assert.equal((await db.query(`select has_function_privilege($1,'public.begin_ticket_checkout_batch(uuid,text,text,jsonb,boolean,boolean,text,text)','EXECUTE') as allowed`,[role])).rows[0].allowed,false);
      assert.equal((await db.query(`select has_table_privilege($1,'public.ticket_order_attendees','SELECT') as allowed`,[role])).rows[0].allowed,false);
    }
  } finally { await db.close(); }
});
