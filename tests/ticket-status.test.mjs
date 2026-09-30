import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOwnedOrderStatus, isCheckoutPendingStatus,
  isIssuedTicketStatus, hasIssuedTickets, isOwnedOrderLine, isUpcomingEvent,
} from '../src/lib/ticket-status.ts';

test('only confirmed orders with issued tickets are owned', () => {
  for (const status of ['confirmed', 'free']) assert.equal(isOwnedOrderStatus(status), true);
  for (const status of ['draft', 'checkout_pending', 'payment_pending', 'pending', 'processing', 'failed', 'expired', 'cancelled', 'refunded', 'manual_review']) {
    assert.equal(isOwnedOrderStatus(status), false, status);
  }
  assert.equal(hasIssuedTickets([{ status: 'cancelled' }, { status: 'refunded' }]), false);
  assert.equal(hasIssuedTickets([{ status: 'cancelled' }, { status: 'valid' }]), true);
  assert.equal(isOwnedOrderLine('pending', [{ status: 'valid' }]), false);
  assert.equal(isOwnedOrderLine('confirmed', [{ status: 'cancelled' }]), false);
  assert.equal(isOwnedOrderLine('confirmed', [{ status: 'valid' }]), true);
  assert.equal(isOwnedOrderLine('free', [{ status: 'checked_in' }]), true);
  assert.equal(isIssuedTicketStatus('checked_in'), true);
  assert.equal(isIssuedTicketStatus('refunded'), false);
});

test('draft and payment holds stay on the checkout side of the status boundary', () => {
  for (const status of ['draft', 'checkout_pending', 'payment_pending', 'pending', 'processing']) {
    assert.equal(isCheckoutPendingStatus(status), true, status);
  }
  for (const status of ['confirmed', 'free', 'failed', 'expired', 'cancelled']) {
    assert.equal(isCheckoutPendingStatus(status), false, status);
  }
  const now = new Date('2026-09-30T12:00:00Z');
  assert.equal(isUpcomingEvent('2026-10-01T12:00:00Z', now), true);
  assert.equal(isUpcomingEvent('2026-09-01T12:00:00Z', now), false);
  assert.equal(isUpcomingEvent('invalid date', now), false);
});
