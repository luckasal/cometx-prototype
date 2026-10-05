import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '../.test-runtime/node_modules/@electric-sql/pglite/dist/index.js';

test('CometXXL recurring membership application validates payment, activates once and syncs cancellation', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as 'select null::uuid';`);
    for (const name of (await readdir('drizzle/migrations')).filter((n) => n.endsWith('.sql')).sort()) {
      await db.exec(await readFile(`drizzle/migrations/${name}`, 'utf8'));
    }

    const userId = '10000000-0000-4000-8000-000000000001';
    await db.query('insert into auth.users(id,email) values($1,$2)', [userId, 'member@example.test']);
    const planId = (await db.query(`update membership_plans set annual_price=250,currency='CHF',active=true,billing_interval='year',setup_fee=1.99
      where slug='cometxxl' returning id`)).rows[0].id;
    const applicationId = (await db.query(`insert into membership_applications(user_id,membership_plan_id,email,nationality,motivation,missing_from_subscription)
      values($1,$2,'member@example.test','czech','Community','More regional events') returning id`, [userId, planId])).rows[0].id;
    const session = {
      id: 'cs_test_membership', livemode: false, payment_status: 'paid', amount_total: 25199, currency: 'chf',
      customer: 'cus_test_membership', subscription: 'sub_test_membership', payment_intent: null,
      metadata: {
        kind: 'membership_application', membership_application_id: applicationId,
        membership_plan_id: planId, user_id: userId, expected_amount: '25199', expected_currency: 'chf',
      },
    };
    await db.query('select fulfill_cometx_membership_application($1::jsonb)', [JSON.stringify(session)]);
    await db.query('select fulfill_cometx_membership_application($1::jsonb)', [JSON.stringify(session)]);
    assert.deepEqual((await db.query('select status,stripe_subscription_id from memberships where user_id=$1', [userId])).rows,
      [{ status: 'active', stripe_subscription_id: 'sub_test_membership' }]);
    assert.equal((await db.query('select amount from payments where stripe_checkout_session_id=$1', [session.id])).rows[0].amount, '251.99');
    assert.equal((await db.query('select status from membership_applications where id=$1', [applicationId])).rows[0].status, 'paid');

    const pastDue = { id: 'sub_test_membership', livemode: false, status: 'past_due', current_period_end: 1_800_000_000 };
    await db.query('select sync_cometx_membership_subscription($1::jsonb)', [JSON.stringify(pastDue)]);
    assert.equal((await db.query('select status from memberships where stripe_subscription_id=$1', [pastDue.id])).rows[0].status, 'past_due');
    const canceled = { ...pastDue, status: 'canceled' };
    await db.query('select sync_cometx_membership_subscription($1::jsonb)', [JSON.stringify(canceled)]);
    assert.equal((await db.query('select status from memberships where stripe_subscription_id=$1', [canceled.id])).rows[0].status, 'cancelled');

    const pendingApplicationId = (await db.query(`insert into membership_applications(user_id,membership_plan_id,email,nationality,motivation,missing_from_subscription)
      values($1,$2,'member@example.test','czech','Community','More regional events') returning id`, [userId, planId])).rows[0].id;
    await assert.rejects(db.query('select fulfill_cometx_membership_application($1::jsonb)', [JSON.stringify({
      ...session, id: 'cs_test_wrong_total', amount_total: 25000,
      metadata: { ...session.metadata, membership_application_id: pendingApplicationId },
    })]), /amount mismatch/);
    assert.equal((await db.query('select count(*)::int as n from payments')).rows[0].n, 1);
  } finally {
    await db.close();
  }
});
