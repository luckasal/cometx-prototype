import test from 'node:test';
import assert from 'node:assert/strict';
import { canCheckInEventTicket, csvCell } from '../src/lib/event-attendees.ts';

test('only valid tickets on fulfilled orders can be checked in', () => {
  assert.equal(canCheckInEventTicket('valid', 'confirmed'), true);
  assert.equal(canCheckInEventTicket('valid', 'free'), true);
  for (const status of ['pending', 'processing', 'failed', 'cancelled', 'refunded', 'manual_review']) {
    assert.equal(canCheckInEventTicket('valid', status), false, status);
  }
  for (const status of ['checked_in', 'cancelled', 'refunded', 'pending']) {
    assert.equal(canCheckInEventTicket(status, 'confirmed'), false, status);
  }
});

test('attendee CSV cells are quoted and formula-safe', () => {
  assert.equal(csvCell('Lucia "L"'), '"Lucia ""L"""');
  assert.equal(csvCell('=HYPERLINK("https://example.com")'), `"'=HYPERLINK(""https://example.com"")"`);
});
