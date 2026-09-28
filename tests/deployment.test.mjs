import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredAppUrl, ticketEmailEnabled } from '../src/lib/deployment.ts';
import { checkoutOrigin } from '../src/lib/checkout.ts';

test('app URL overrides legacy site URL without a hardcoded hostname', () => {
  assert.equal(configuredAppUrl({APP_URL:' https://staging.example ',SITE_URL:'https://old.example'}),'https://staging.example');
  assert.equal(configuredAppUrl({APP_URL:' ',SITE_URL:'https://next.example'}),'https://next.example');
  assert.throws(() => checkoutOrigin(configuredAppUrl({})));
});
test('email can be pending without pretending to deliver messages', () => {
  assert.equal(ticketEmailEnabled({}),false);
  assert.equal(ticketEmailEnabled({TICKET_EMAIL_MODE:'disabled',RESEND_API_KEY:'fixture'}),false);
  assert.throws(() => ticketEmailEnabled({TICKET_EMAIL_MODE:'enabled'}));
  assert.throws(() => ticketEmailEnabled({TICKET_EMAIL_MODE:'typo'}));
  assert.equal(ticketEmailEnabled({TICKET_EMAIL_MODE:'enabled',RESEND_API_KEY:'fixture',RESEND_FROM_EMAIL:'tickets@example.test'}),true);
});
