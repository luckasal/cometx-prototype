import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '../.test-runtime/node_modules/@electric-sql/pglite/dist/index.js';

test('workshop voucher is opt-in and reserved only once across events', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as 'select null::uuid';`);
    // These three hosted-only migrations need Supabase Auth/Storage internals absent in PGlite.
    for (const name of (await readdir('drizzle/migrations')).filter((name) => name.endsWith('.sql') && !['0016_', '0018_', '0019_'].some((prefix) => name.startsWith(prefix))).sort()) {
      await db.exec(await readFile(`drizzle/migrations/${name}`, 'utf8'));
    }
    const userId = (await db.query("insert into auth.users(id,email) values(gen_random_uuid(),'credit@example.invalid') returning id")).rows[0].id;
    const planId = (await db.query("select id from membership_plans where slug='cometxxl'")).rows[0].id;
    const membership = (await db.query("insert into memberships(user_id,membership_plan_id,status) values($1,$2,'active') returning starts_at", [userId, planId])).rows[0];
    const events = [];
    for (const slug of ['credit-workshop-a', 'credit-workshop-b']) {
      const eventId = (await db.query(`insert into events(title,slug,start_date,status,event_type,capacity)
        values($1,$2,now()+interval '1 year','registration_open','workshop',100) returning id`, [slug, slug])).rows[0].id;
      const ticketId = (await db.query('insert into ticket_types(event_id,name,base_price,capacity) values($1,$2,265,100) returning id', [eventId, 'Workshop ticket'])).rows[0].id;
      events.push({ slug, ticketId });
    }
    const select = (event, useWorkshopCredit, quantity = 1) => [{ eventSlug: event.slug, useWorkshopCredit,
      lines: [{ ticketId: event.ticketId, quantity, attendees: Array.from({ length: quantity }, (_, i) => ({ firstName: `Person${i}`, lastName: 'Test' })) }] }];
    const checkout = async (selection) => (await db.query(
      'select begin_ticket_checkout_batch($1,null,null,$2::jsonb,true,true) as result', [userId, JSON.stringify(selection)],
    )).rows[0].result;

    const fullPrice = await checkout(select(events[0], false));
    assert.equal(fullPrice.amount_minor, 26500);
    assert.equal((await db.query('select workshop_credit_is_used($1,$2) as used', [userId, membership.starts_at])).rows[0].used, false);

    const discounted = await checkout(select(events[1], true, 2));
    assert.equal(discounted.amount_minor, 43000);
    assert.deepEqual((await db.query('select benefit_type,quantity,unit_amount_minor from ticket_order_items where order_id=$1 order by unit_amount_minor', [discounted.order_id])).rows.map((row) => [row.benefit_type, row.quantity, Number(row.unit_amount_minor)]), [
      ['workshop_credit', 1, 16500], ['public', 1, 26500],
    ]);
    await assert.rejects(checkout(select(events[0], true)), /workshop credit has already been used/);

    await db.query("update ticket_orders set status='expired' where id=$1", [discounted.order_id]);
    const retry = await checkout(select(events[0], true));
    assert.equal(retry.amount_minor, 16500);
    await db.query("update ticket_orders set status='confirmed' where id=$1", [retry.order_id]);
    await assert.rejects(checkout(select(events[1], true)), /workshop credit has already been used/);

    const legacyUser = (await db.query("insert into auth.users(id,email) values(gen_random_uuid(),'legacy-credit@example.invalid') returning id")).rows[0].id;
    await db.query("insert into memberships(user_id,membership_plan_id,status) values($1,$2,'active')", [legacyUser, planId]);
    const legacyInput = select(events[0], false).map(({ useWorkshopCredit, ...event }) => event);
    const legacy = (await db.query('select begin_ticket_checkout_batch($1,null,null,$2::jsonb,true,true) as result', [legacyUser, JSON.stringify(legacyInput)])).rows[0].result;
    assert.equal(legacy.amount_minor, 16500, 'old app remains price-compatible during migration-first release');
  } finally {
    await db.close();
  }
});
