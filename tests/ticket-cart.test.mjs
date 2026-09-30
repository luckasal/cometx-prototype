import test from 'node:test';
import assert from 'node:assert/strict';
import { addTicketToCart, buyerNamedAttendeeCount, clearAttendeeName, completePurchasedTicketCart, copyBuyerNameToAttendee, readTicketCart, writeTicketCart, ticketCartCount } from '../src/lib/ticket-cart.ts';

test('only one ticket per event uses the buyer name, while another event can also use it', () => {
  const lines = [
    { eventSlug: 'event-a', ticketId: 'a', quantity: 2, attendees: [{ firstName: 'Other', lastName: 'Person' }, { firstName: '', lastName: '' }] },
    { eventSlug: 'event-a', ticketId: 'c', quantity: 1, attendees: [{ firstName: '', lastName: '' }] },
    { eventSlug: 'event-b', ticketId: 'b', quantity: 1, attendees: [{ firstName: '', lastName: '' }] },
  ];
  const buyer = { firstName: '  Buyer  ', lastName: ' Name ' };
  const result = copyBuyerNameToAttendee(lines, lines[2], 0, buyer);
  assert.deepEqual(result[0], lines[0]);
  assert.deepEqual(result[2].attendees, [{ firstName: 'Buyer', lastName: 'Name' }]);
  assert.equal(buyerNamedAttendeeCount(result, 'event-b', buyer), 1);
  assert.equal(buyerNamedAttendeeCount(result, 'event-a', buyer), 0);
  const second = copyBuyerNameToAttendee(result, result[0], 1, buyer);
  assert.deepEqual(second[0].attendees, [{ firstName: 'Other', lastName: 'Person' }, { firstName: 'Buyer', lastName: 'Name' }]);
  assert.deepEqual(second[2], result[2]);
  assert.equal(buyerNamedAttendeeCount(second, 'event-a', buyer), 1);
  const moved = copyBuyerNameToAttendee(second, second[1], 0, buyer);
  assert.deepEqual(moved[0].attendees, [{ firstName: 'Other', lastName: 'Person' }, { firstName: '', lastName: '' }]);
  assert.deepEqual(moved[1].attendees, [{ firstName: 'Buyer', lastName: 'Name' }]);
  assert.equal(buyerNamedAttendeeCount(moved, 'event-a', buyer), 1);
  assert.equal(buyerNamedAttendeeCount(moved, 'event-b', buyer), 1);
  const firstAttendee = copyBuyerNameToAttendee(moved, moved[0], 0, buyer);
  assert.deepEqual(firstAttendee[0].attendees, [{ firstName: 'Buyer', lastName: 'Name' }, { firstName: '', lastName: '' }]);
  assert.deepEqual(firstAttendee[1].attendees, [{ firstName: '', lastName: '' }]);
  assert.equal(buyerNamedAttendeeCount(firstAttendee, 'event-a', buyer), 1);
  assert.equal(buyerNamedAttendeeCount(firstAttendee, 'event-b', buyer), 1);
  assert.deepEqual(lines[2].attendees, [{ firstName: '', lastName: '' }]);
  assert.equal(buyerNamedAttendeeCount([...moved, { eventSlug: 'event-a', ticketId: 'd', quantity: 1, attendees: [{ firstName: ' buyer ', lastName: 'NAME' }] }], 'event-a', buyer), 2);
  const cleared = clearAttendeeName(moved, moved[1], 0);
  assert.equal(buyerNamedAttendeeCount(cleared, 'event-a', buyer), 0);
  assert.deepEqual(cleared[0], moved[0]);
  assert.deepEqual(cleared[2], moved[2]);
});

test('event groups and attendee drafts survive edits; completing one event preserves the other', () => {
  const previous = globalThis.window;
  const storage = new Map();
  globalThis.window = { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) }, dispatchEvent() {} };
  const a = '00000000-0000-4000-8000-000000000001';
  const b = '00000000-0000-4000-8000-000000000002';
  const c = '00000000-0000-4000-8000-000000000003';
  try {
    addTicketToCart('event-a', a, 2);
    addTicketToCart('event-a', b, 1);
    addTicketToCart('event-b', c, 2);
    assert.equal(readTicketCart().length, 3);
    assert.equal(ticketCartCount(readTicketCart()), 5);
    const lines = readTicketCart();
    lines[0].attendees = [{ firstName: 'First', lastName: 'Guest' }, { firstName: 'Second', lastName: 'Guest' }];
    writeTicketCart(lines);
    addTicketToCart('event-a', a, 1);
    assert.equal(readTicketCart()[0].attendees[1].firstName, 'Second');
    assert.equal(readTicketCart()[0].quantity, 3);
    writeTicketCart(readTicketCart().filter(line => line.eventSlug !== 'event-a'));
    assert.deepEqual(readTicketCart().map(line => [line.eventSlug, line.quantity]), [['event-b', 2]]);
    writeTicketCart([{ eventSlug: 'event-b', ticketId: c, quantity: 1, attendees: [{ firstName: 'Keep', lastName: 'Me' }, { firstName: 'Remove', lastName: 'Me' }] }]);
    assert.equal(readTicketCart()[0].attendees.length, 1);
    writeTicketCart([{ eventSlug: 'event-a', ticketId: a, quantity: 3, attendees: [{ firstName: 'Bought', lastName: 'One' }, { firstName: 'Bought', lastName: 'Two' }, { firstName: 'New', lastName: 'Person' }] },
      { eventSlug: 'event-b', ticketId: c, quantity: 1 }]);
    completePurchasedTicketCart('paid-batch-1', [{ eventSlug: 'event-a', ticketId: a, quantity: 2 }]);
    assert.deepEqual(readTicketCart().map(line => [line.eventSlug, line.quantity]), [['event-a', 1], ['event-b', 1]]);
    assert.equal(readTicketCart()[0].attendees[0].firstName, 'New');
    completePurchasedTicketCart('paid-batch-1', [{ eventSlug: 'event-a', ticketId: a, quantity: 2 }]);
    assert.deepEqual(readTicketCart().map(line => [line.eventSlug, line.quantity]), [['event-a', 1], ['event-b', 1]]);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
