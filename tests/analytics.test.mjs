import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnalyticsConsent, purchaseMetadata, sanitizeAnalyticsLocation, ticketPricingType, trackConfirmedPurchase, trackEvent, trackPageView } from '../src/lib/analytics.ts';

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

test('single-event purchase adds only non-identifying event and ticket metadata', () => {
  const order = paidOrder({
    ticket_order_items: [{
      event_id: 'event-one',
      ticket_type_id: 'ticket-one',
      ticket_name: 'Standard',
      events: [{ slug: 'sample-event' }],
      quantity: 1,
      ticket_attendees: [issuedAttendee()],
    }],
  });
  assert.deepEqual(purchaseMetadata([order]), {
    value: 50,
    currency: 'CHF',
    quantity: 1,
    event_count: 1,
    event_id: 'event-one',
    event_slug: 'sample-event',
    ticket_type_id: 'ticket-one',
    ticket_type: 'Standard',
  });
});

test('ticket pricing category is non-identifying and reflects included/member/public prices', () => {
  assert.equal(ticketPricingType({ benefitType: 'public', includedInMembership: false }), 'public');
  assert.equal(ticketPricingType({ benefitType: 'discount', includedInMembership: false }), 'member');
  assert.equal(ticketPricingType({ benefitType: 'free', includedInMembership: false }), 'included');
});

test('analytics location excludes query parameters and fragments', () => {
  assert.equal(
    sanitizeAnalyticsLocation('https://cometx.example/account/events?email=buyer%40example.com&token=secret#purchase'),
    'https://cometx.example/account/events',
  );
  assert.equal(sanitizeAnalyticsLocation('https://cometx.example/'), 'https://cometx.example/');
});

test('analytics remains inert until a visitor grants consent', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const stored = new Map();
  globalThis.window = {
    location: { href: 'https://cometx.example/events?token=private', pathname: '/events', origin: 'https://cometx.example' },
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
  };
  globalThis.document = { title: 'Events' };
  try {
    assert.equal(getAnalyticsConsent(), null);
    trackEvent('event_view', { event_slug: 'example' });
    trackPageView('/events');
    trackConfirmedPurchase('private-order-id', [paidOrder()]);
    assert.equal(stored.size, 0);
    assert.equal(globalThis.window.dataLayer, undefined);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});
