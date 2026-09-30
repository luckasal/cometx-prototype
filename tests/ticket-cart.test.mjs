import test from 'node:test';
import assert from 'node:assert/strict';
import { addTicketToCart, readTicketCart, writeTicketCart, ticketCartCount } from '../src/lib/ticket-cart.ts';

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
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
