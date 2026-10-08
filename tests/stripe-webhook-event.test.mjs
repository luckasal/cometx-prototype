import test from 'node:test';
import assert from 'node:assert/strict';
import { stripeWebhookEventSchema } from '../src/lib/stripe-webhook-event.ts';

test('accepts a completed Stripe Checkout Session with nullable fields', () => {
  const event = {
    type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_test_example',
      url: null,
      amount_total: 25199,
      currency: 'chf',
      metadata: { kind: 'membership_application' },
      payment_status: 'paid',
      livemode: false,
    } },
  };
  assert.equal(stripeWebhookEventSchema.parse(event).data.object.metadata.kind, 'membership_application');
});

test('rejects a malformed Checkout Session even with nullable fields', () => {
  assert.equal(stripeWebhookEventSchema.safeParse({
    type: 'checkout.session.completed',
    data: { object: { id: '', url: null } },
  }).success, false);
});

test('accepts an expired unpaid session with unavailable amount and currency', () => {
  assert.equal(stripeWebhookEventSchema.safeParse({
    type: 'checkout.session.expired',
    data: { object: {
      id: 'cs_test_expired',
      url: null,
      amount_total: null,
      currency: null,
      metadata: {},
      payment_status: 'unpaid',
      livemode: false,
    } },
  }).success, true);
});
