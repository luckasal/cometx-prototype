import test from 'node:test';
import assert from 'node:assert/strict';
import { isCometxManualInvoiceEvent, stripeWebhookEventSchema } from '../src/lib/stripe-webhook-event.ts';

test('routes only CometX manual invoice events to invoice status sync', () => {
  const manual = { type: 'invoice.paid', data: { object: { id: 'in_test', metadata: {
    kind: 'cometx_manual_invoice', cometx_source: 'ticket',
    cometx_request_id: '11111111-1111-4111-8111-111111111111',
  } } } };
  assert.equal(isCometxManualInvoiceEvent(manual), true);
  assert.equal(isCometxManualInvoiceEvent({ ...manual, data: { object: { ...manual.data.object, metadata: { kind: 'cometx_membership' } } } }), false);
  assert.equal(isCometxManualInvoiceEvent({ ...manual, type: 'checkout.session.completed' }), false);
});

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
