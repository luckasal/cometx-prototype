import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { calculateTicketPrice, hasCapacity, hasEntitlementIn, entitlementValueIn, isDuplicateRegistration, isRegistrationOpen } from '../src/lib/pricing.ts';
import { safeReturnPath } from '../src/lib/navigation.ts';
import { checkoutOrigin, isPaidCheckout } from '../src/lib/checkout.ts';
import { verifyStripeSignature, getStripeSecretKey } from '../src/lib/stripe.server.ts';

const ticket = { basePrice: 120, currency: 'CHF', freeEntitlement: 'symposium_free_ticket', discountEntitlement: 'event_discount' };

test('guests pay the standard server price', () => {
  assert.equal(calculateTicketPrice(ticket, {}).finalPrice, 120);
});
test('included symposium ticket takes priority over percentage discount', () => {
  const result = calculateTicketPrice(ticket, { symposium_free_ticket: 1, event_discount: 20 });
  assert.equal(result.finalPrice, 0);
  assert.equal(result.includedInMembership, true);
});
test('discount is rounded in money units and clamped to 0..100', () => {
  assert.equal(calculateTicketPrice(ticket, { event_discount: 20 }).finalPrice, 96);
  assert.equal(calculateTicketPrice(ticket, { event_discount: 200 }).finalPrice, 0);
  assert.equal(calculateTicketPrice(ticket, { event_discount: -20 }).finalPrice, 120);
  assert.equal(calculateTicketPrice({ ...ticket, basePrice: 19.99 }, { event_discount: 15 }).finalPrice, 16.99);
});
test('required benefits cannot be bypassed by free-ticket benefits', () => {
  assert.equal(calculateTicketPrice({ ...ticket, requiredEntitlement: 'priority_registration' }, { symposium_free_ticket: 1 }).eligible, false);
});
test('benefits support flags, numerical values and missing keys', () => {
  assert.equal(hasEntitlementIn({ premium_content: null }, 'premium_content'), true);
  assert.equal(hasEntitlementIn({}, 'toString'), false);
  assert.equal(entitlementValueIn({ workshop_credit: 100 }, 'workshop_credit'), 100);
  assert.equal(entitlementValueIn({}, 'workshop_credit'), null);
});
test('invalid prices and discounts fail closed', () => {
  for (const basePrice of [-1, NaN, Infinity]) assert.throws(() => calculateTicketPrice({ ...ticket, basePrice }, {}));
  assert.throws(() => calculateTicketPrice(ticket, { event_discount: NaN }));
});
test('both ticket and event capacity constrain registration', () => {
  const capacity = { eventCapacity: 100, ticketCapacity: 10, eventConfirmedCount: 90, ticketConfirmedCount: 9 };
  assert.equal(hasCapacity(capacity), true);
  assert.equal(hasCapacity({ ...capacity, eventConfirmedCount: 100 }), false);
  assert.equal(hasCapacity({ ...capacity, ticketConfirmedCount: 10 }), false);
  assert.equal(hasCapacity({ ...capacity, eventCapacity: null, ticketCapacity: null }), true);
});
test('pending, confirmed and checked-in registrations block duplicates', () => {
  for (const status of ['pending', 'confirmed', 'checked_in']) assert.equal(isDuplicateRegistration([{ status }]), true);
  assert.equal(isDuplicateRegistration([{ status: 'cancelled' }]), false);
  assert.equal(isDuplicateRegistration(null), false);
});
test('registration respects status, dates and invalid data', () => {
  const event = { status: 'registration_open', registrationStart: '2026-01-01', registrationEnd: '2026-12-31' };
  const now = new Date('2026-06-01');
  assert.equal(isRegistrationOpen(event, now), true);
  assert.equal(isRegistrationOpen({ ...event, status: 'draft' }, now), false);
  assert.equal(isRegistrationOpen({ ...event, registrationEnd: '2026-05-01' }, now), false);
  assert.equal(isRegistrationOpen({ ...event, registrationStart: 'invalid' }, now), false);
});
test('login cannot redirect to an external or malformed URL', () => {
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example', undefined]) assert.equal(safeReturnPath(value), '/account');
  assert.equal(safeReturnPath('/events/symposium?ticket=1'), '/events/symposium?ticket=1');
});
test('checkout requires a configured, secure destination', () => {
  assert.equal(checkoutOrigin('http://127.0.0.1:3001'), 'http://127.0.0.1:3001');
  assert.equal(checkoutOrigin('https://cometx.ch/path'), 'https://cometx.ch');
  for (const origin of [undefined, 'http://external.example', 'https://user:pass@example.com']) assert.throws(() => checkoutOrigin(origin));
});
test('only paid test sessions may grant tickets or membership', () => {
  assert.equal(isPaidCheckout({ payment_status: 'paid', livemode: false }), true);
  for (const session of [{ payment_status: 'unpaid', livemode: false }, { payment_status: 'paid', livemode: true }, {}]) assert.equal(isPaidCheckout(session), false);
});
test('Stripe live-mode keys cannot be used by the prototype', () => {
  process.env.STRIPE_SECRET_KEY = 'sk_live_test_fixture';
  assert.throws(() => getStripeSecretKey(), /test-mode/);
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
  assert.equal(getStripeSecretKey(), 'sk_test_fixture');
  delete process.env.STRIPE_SECRET_KEY;
});
test('webhooks verify raw payload, freshness and any rotated v1 signature', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test_only';
  const body = JSON.stringify({ type: 'checkout.session.completed' });
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = (t) => createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
  assert.deepEqual(await verifyStripeSignature(body, `t=${timestamp},v1=${sign(timestamp)},v1=invalid`), JSON.parse(body));
  await assert.rejects(verifyStripeSignature(body + ' ', `t=${timestamp},v1=${sign(timestamp)}`));
  await assert.rejects(verifyStripeSignature(body, `t=${timestamp - 600},v1=${sign(timestamp - 600)}`));
  await assert.rejects(verifyStripeSignature(body, null));
  delete process.env.STRIPE_WEBHOOK_SECRET;
});
