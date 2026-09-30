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
    assert.equal((await db.query('select count(*)::int as n from ticket_orders where checkout_batch_id=$1',[batch.id])).rows[0].n,2);
    assert.equal((await db.query('select count(*)::int as n from ticket_attendees where order_id=any($1::uuid[])',[batch.order_ids])).rows[0].n,0);
    await db.query('select save_ticket_checkout_batch_session($1,$2)',[batch.id,'cs_test_batch']);
    const batchSession={id:'cs_test_batch',livemode:false,amount_total:6000,currency:'chf',payment_status:'paid',payment_intent:'pi_batch',customer:'cus_batch',metadata:{batch_id:batch.id}};
    await db.query(`select apply_ticket_checkout_batch_event('checkout.session.completed',$1::jsonb)`,[JSON.stringify(batchSession)]);
    await db.query(`select apply_ticket_checkout_batch_event('checkout.session.completed',$1::jsonb)`,[JSON.stringify(batchSession)]);
    const issued = (await db.query('select a.attendee_name,a.attendee_email from ticket_attendees a where a.order_id=any($1::uuid[]) order by a.attendee_name',[batch.order_ids])).rows;
    assert.deepEqual(issued.map(x=>x.attendee_name),['Alice Guest','Bea Guest','Bob Guest','Casey Guest']);
    assert.ok(issued.every(x=>x.attendee_email==='test@example.invalid'));
    assert.equal((await db.query('select status from ticket_checkout_batches where id=$1',[batch.id])).rows[0].status,'confirmed');
    assert.equal((await db.query('select count(*)::int as n from payments where checkout_batch_id=$1 and status=\'paid\'',[batch.id])).rows[0].n,2);
    assert.equal(Number((await db.query('select sum(amount)::numeric as n from payments where checkout_batch_id=$1',[batch.id])).rows[0].n),60);
    for (const role of ['anon','authenticated']) {
      assert.equal((await db.query(`select has_function_privilege($1,'public.begin_ticket_order(uuid,text,text,jsonb,boolean,text,text)','EXECUTE') as allowed`,[role])).rows[0].allowed,false);
    }
  } finally { await db.close(); }
});
