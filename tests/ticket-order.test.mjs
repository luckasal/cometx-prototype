import test from 'node:test';
import assert from 'node:assert/strict';
import { createTicketCheckoutLineItems, createTicketPriceDataLineItem, quoteTicketOrder } from '../src/lib/ticket-order.ts';

// Test fixtures only; these are not CometX ticket prices or benefits.
const price = { basePrice: 100, finalPrice: 80, currency: 'CHF', eligible: true,
  discount: 20, reason: 'Fixture', includedInMembership: false };
const line = (ticketId, quantity, values = {}) => ({ ticketId, quantity, price: { ...price, ...values } });
test('builds dynamic Stripe line items from the saved final amount', () => {
  assert.deepEqual(createTicketPriceDataLineItem({
    ticketName: 'Regular ticket', unitAmountMinor: 31500, currency: 'CHF', quantity: 2,
  }), {
    price_data: { currency: 'chf', unit_amount: 31500, product_data: { name: 'Regular ticket' } },
    quantity: 2,
  });
});
test('rejects invalid dynamic Stripe line item amounts, quantities, currencies and names', () => {
  const valid = { ticketName: 'Fixture ticket', unitAmountMinor: 1000, currency: 'CHF', quantity: 1 };
  for (const invalid of [
    { unitAmountMinor: 0 }, { unitAmountMinor: Number.MAX_SAFE_INTEGER + 1 },
    { quantity: 0 }, { quantity: 11 }, { currency: 'JPY' }, { ticketName: '  ' },
  ]) {
    assert.throws(() => createTicketPriceDataLineItem({ ...valid, ...invalid }));
  }
});
test('builds Checkout lines only from saved order snapshots and reconciles the server total', () => {
  const savedItems = [
    { ticket_name: 'Regular ticket', unit_amount_minor: 31500, currency: 'CHF', quantity: 2 },
    { ticket_name: 'Included workshop ticket', unit_amount_minor: 0, currency: 'CHF', quantity: 1 },
  ];
  assert.deepEqual(createTicketCheckoutLineItems(savedItems, 63000, 'CHF'), [{
    price_data: { currency: 'chf', unit_amount: 31500, product_data: { name: 'Regular ticket' } }, quantity: 2,
  }]);
  assert.throws(() => createTicketCheckoutLineItems(savedItems, 1, 'CHF'), /does not match/);
  assert.throws(() => createTicketCheckoutLineItems([
    { ...savedItems[0], currency: 'EUR' },
  ], 63000, 'CHF'), /invalid/i);
});
test('regular quantities and multiple types produce integer CHF totals', () => {
  const result = quoteTicketOrder([line('a', 2, { finalPrice: 100 }), line('b', 3, { basePrice: 20.25, finalPrice: 20.25 })]);
  assert.equal(result.quantity, 5);
  assert.equal(result.amount, 26075);
});
test('multi-ticket member pricing requires explicit policy', () => {
  assert.throws(() => quoteTicketOrder([line('a', 2)]), /configure/);
  assert.equal(quoteTicketOrder([line('a', 1)]).amount, 8000);
});
test('one-member policy discounts exactly one chosen ticket across the basket', () => {
  const result = quoteTicketOrder([line('a', 2), line('b', 3)], { scope: 'one', memberTicketId: 'b' });
  assert.equal(result.amount, 48000);
  assert.equal(result.lines[0].memberQuantity, 0);
  assert.equal(result.lines[1].memberQuantity, 1);
  assert.throws(() => quoteTicketOrder([line('a', 2)], { scope: 'one' }), /Select/);
});
test('all-ticket policy applies trusted member price to each ticket', () => {
  assert.equal(quoteTicketOrder([line('a', 3)], { scope: 'all' }).amount, 24000);
});
test('one-member policy matches checkout across supported currencies', () => {
  const result = quoteTicketOrder([line('a', 2, { currency: 'EUR' })], { scope: 'one', memberTicketId: 'a' });
  assert.equal(result.currency, 'EUR');
  assert.equal(result.amount, 18000);
  assert.equal(result.lines[0].memberQuantity, 1);
  assert.equal(result.lines[0].regularQuantity, 1);
  assert.throws(() => quoteTicketOrder([line('a', 1), line('b', 1, { currency: 'EUR' })]), /same currency/);
});
test('included ticket benefit does not silently grant free guest tickets', () => {
  const result = quoteTicketOrder([line('a', 3, { finalPrice: 0 })], { scope: 'one', memberTicketId: 'a' });
  assert.equal(result.amount, 20000);
});
test('reject invalid quantities, prices, currency, eligibility and duplicate types', () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => quoteTicketOrder([line('a', quantity)]));
  }
  for (const values of [{ finalPrice: NaN }, { basePrice: -1 }, { finalPrice: 101 }, { currency: 'JPY' }, { eligible: false }]) {
    assert.throws(() => quoteTicketOrder([line('a', 1, values)]));
  }
  assert.throws(() => quoteTicketOrder([]));
  assert.throws(() => quoteTicketOrder([line('a', 1), line('a', 1)]));
});
