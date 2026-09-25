# CometX Stripe sandbox plan

## Current status — 25 September 2026

The Stripe connection is the CometX sandbox (test mode). Hosted Checkout was selected. The implementation is on `codex-dev`; it is not deployed to Production. Vercel generated a branch Preview, but it cannot load because Supabase public variables are configured for Production only.

Implemented on `codex-dev` (not released):

- `/admin` event editor manages ticket public/member prices, capacity, currency, and sale windows. Stripe IDs are server-only.
- On event save, the server synchronizes Products and Prices using stable metadata/lookup keys and idempotency keys. Price changes create a new immutable Stripe Price.
- Guests and members can purchase. Guests provide buyer name/email and pay public prices; members use account data and may receive member prices/free entry only from active Supabase entitlements. The browser sends ticket IDs/quantities, never prices.
- Guest checkout fails closed until Resend API key/from-address and the stable guest-token secret are configured, ensuring the guest access email flow can be delivered.
- One order supports multiple ticket types and up to 10 tickets. Supabase validates sale/publish windows, currency, price, entitlements and event/per-ticket capacity under an event lock. Stripe Checkout receives only server-quoted paid lines; free tickets bypass Stripe.
- New tables separate orders, order items, attendees, contacts, members and payments. Guest orders create/update a contact without newsletter consent or an account. A high-entropy secure link displays guest tickets; a later account with matching email can claim them.
- Confirmed orders and ticket records are created only after a signed test-mode webhook confirms payment. Failed/cancelled sessions create no confirmed tickets. Late payments or capacity conflicts are recorded for staff manual review.
- `/account/events` shows purchased tickets, event/date, ticket type, quantity, amount, status, ticket codes and Buy more. `/admin/orders` shows buyers/attendees, guest/member, payment/order status, ticket counts and confirmed revenue by currency. Refund initiation is not enabled.
- Stripe IDs, private mappings, guest-token data and payment data remain server-side; ticket details are managed in CometX admin.

Current business-rule interpretation: an authenticated buyer’s active membership price/free entitlement applies to every ticket in their basket. CometX should confirm this before Production, especially if the member benefit is intended only for the member and not additional guests.

The working tree contains migrations `0005_hidden_ticket_payments.sql` and `0006_ticket_orders_and_guests.sql`. Neither is **applied**. A read-only query on Supabase project `vlcssswzlvamtscyobbv` confirmed no 0005 schema/functions when that preflight was run. Apply both only after review and with coordinated deployment because 0005 replaces older registration RPC behavior.

Vercel has server-only entries for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `SITE_URL` in Production/Preview. Their values were not read or revealed. Guest email delivery additionally needs `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `GUEST_TICKET_TOKEN_SECRET`. Preview has no public Supabase variables and remains disconnected from live data. Local server secrets are absent. The app rejects live Stripe keys for ticket checkout. Stripe sandbox Workbench has no webhook destination. No end-to-end purchase/webhook has been tested; no payment or Production deployment has occurred.

TypeScript and production build pass. Existing TanStack deprecation and bundle-size warnings remain unrelated to this integration.

## Required release steps

1. Claude reviews migration, permissions, webhook checks, and checkout/capacity edge cases. Codex fixes blockers on `codex-dev`.
2. After review is clean, deploy the new server code and apply migrations 0005 then 0006 in a coordinated release so the existing site does not run against replaced RPCs.
3. Add a **test-mode** Stripe webhook destination at `/api/public/stripe-webhook` on the chosen HTTPS deployment. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`.
4. Set only the test signing secret in the correct Vercel environment and use the deployed site as `SITE_URL`. Keep secrets server-only; do not paste them into chat or client variables.
5. Verify the runtime secret is a test-mode key without exposing its value. Run guest and member orders, multiple types/quantities, free/paid lines, declined/cancelled, expiry, member/free entitlement, capacity contention and guest email/claim; confirm orders, tickets and revenue in Supabase and `/admin`.

Do not call checkout live until a sandbox transaction has produced a webhook-confirmed order and tickets. Live mode is a separate reviewed release.

## Product scope decisions

| Stripe product | Current scope / later decision |
| --- | --- |
| Payments | Sandbox Checkout for CometX event tickets. |
| Billing | Not enabled. Confirm subscription interval, renewals, cancellations and entitlement rules first. |
| Invoicing | Payment table can store invoice/receipt URLs; decide document and legal requirements before enabling invoice creation. |
| Connect | Not needed for CometX's own tickets. Consider only if third-party sellers/organizers receive payouts. |
| Terminal | Not enabled. Confirm in-person checkout/check-in needs before designing it. |
| Tax | Not enabled. Confirm product classification and tax treatment before configuring registrations or automatic tax. |
