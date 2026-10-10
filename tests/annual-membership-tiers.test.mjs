import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('all membership tiers use annual subscription Checkout with first-payment setup fee', async () => {
  const migration = await readFile('drizzle/migrations/0015_all_annual_memberships.sql', 'utf8');
  const checkout = await readFile('src/lib/membership.functions.ts', 'utf8');
  const catalog = await readFile('src/lib/membership-payments.server.ts', 'utf8');
  const page = await readFile('src/routes/membership.tsx', 'utf8');
  const admin = await readFile('src/lib/admin.functions.ts', 'utf8');
  assert.match(migration, /slug in \('fanousek','cometxxl','ambasador'\)/);
  assert.match(migration, /billing_interval = 'year', setup_fee = 1\.99/);
  assert.match(migration, /items'->'data'/);
  assert.match(checkout, /plan\.billing_interval !== "year" \|\| Number\(plan\.setup_fee\) !== 1\.99/);
  assert.match(checkout, /const mode = "subscription"/);
  assert.doesNotMatch(checkout, /mode = plan\.billing_interval \? "subscription" : "payment"/);
  assert.match(catalog, /input\.interval === "year" && input\.setupFee === 1\.99/);
  assert.doesNotMatch(catalog, /billing: "one_time"/);
  assert.match(page, /Renews annually until canceled/);
  assert.doesNotMatch(page, /No automatic renewal/);
  assert.match(admin, /billing_interval: "year", setup_fee: 1\.99/);
});

test('recurring paid invoices are recorded idempotently against membership payments', async () => {
  const migration = await readFile('drizzle/migrations/0017_membership_recurring_invoice_ledger.sql', 'utf8');
  const webhook = await readFile('src/routes/api/public/stripe-webhook.ts', 'utf8');
  assert.match(migration, /payments_stripe_invoice_id_unique/);
  assert.match(migration, /billing_reason.*subscription_create/s);
  assert.match(migration, /record_cometx_membership_invoice_paid/);
  assert.match(migration, /grant execute .* to service_role/i);
  assert.match(webhook, /event\.type === "invoice\.paid"/);
  assert.match(webhook, /record_cometx_membership_invoice_paid/);
});
