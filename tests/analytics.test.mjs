import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseMetadata, sanitizeAnalyticsLocation } from '../src/lib/analytics.ts';

const issuedAttendee = (status = 'valid') => ({ status });

const paidOrder = (overrides = {}) => ({
  id: 'order-one',
  status: 'confirmed',
  amount_minor: 5000,
  currency: 'CHF',
  payments: [{ status: 'paid' }],
  ticket_order_items: [{
    event_id: 'event-one',
    quantity: 1,
    ticket_attendees: [issuedAttendee()],
  }],
  ...overrides,
});

test('purchase metadata aggregates only paid, fully issued orders without identifiers or buyer data', () => {
  const orders = [
    paidOrder({
      amount_minor: 12345,
      currency: 'chf',
      buyer_email: 'buyer@example.com',
      ticket_order_items: [
        { event_id: 'event-one', quantity: 2, ticket_attendees: [issuedAttendee(), issuedAttendee('checked_in')] },
        { event_id: 'event-two', quantity: 1, ticket_attendees: [issuedAttendee()] },
      ],
    }),
    paidOrder({
      id: 'order-two',
      amount_minor: 2055,
      ticket_order_items: [
        { event_id: 'event-one', quantity: 1, ticket_attendees: [issuedAttendee()] },
      ],
    }),
  ];

  assert.deepEqual(purchaseMetadata(orders), {
    value: 144,
    currency: 'CHF',
    quantity: 4,
    event_count: 2,
  });
});

test('purchase metadata rejects unconfirmed, unpaid, mixed-currency, or unissued orders', () => {
  assert.equal(purchaseMetadata([]), null);
  assert.equal(purchaseMetadata([paidOrder({ status: 'checkout_pending' })]), null);
  assert.equal(purchaseMetadata([paidOrder({ amount_minor: 0 })]), null);
  assert.equal(purchaseMetadata([paidOrder({ payments: [{ status: 'pending' }] })]), null);
  assert.equal(purchaseMetadata([paidOrder(), paidOrder({ currency: 'EUR' })]), null);

  for (const item of [
    { event_id: 'event-one', quantity: 0, ticket_attendees: [issuedAttendee()] },
    { event_id: 'event-one', quantity: 2, ticket_attendees: [issuedAttendee()] },
    { event_id: 'event-one', quantity: 1, ticket_attendees: [issuedAttendee('cancelled')] },
  ]) {
    assert.equal(purchaseMetadata([paidOrder({ ticket_order_items: [item] })]), null);
  }
});

test('analytics location excludes query parameters and fragments', () => {
  assert.equal(
    sanitizeAnalyticsLocation('https://cometx.example/account/events?email=buyer%40example.com&token=secret#purchase'),
    'https://cometx.example/account/events',
  );
  assert.equal(sanitizeAnalyticsLocation('https://cometx.example/'), 'https://cometx.example/');
});
