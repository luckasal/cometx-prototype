# CometX Stripe sandbox plan

## Current status — 25 September 2026

The Stripe connection is the CometX sandbox (test mode). Hosted Checkout was selected. The implementation is on `codex-dev`; it is not deployed or enabled on the public site.

Implemented in this branch:

- `/admin` event editor manages ticket public/member prices, capacity, currency, and sale windows. Stripe IDs are server-only.
- On event save, the server synchronizes Products and Prices using stable metadata/lookup keys and idempotency keys. Price changes create a new immutable Stripe Price.
- Checkout requires sign-in and checks event/ticket availability, sale dates, capacity and membership entitlements on the server. The server calculates price from Supabase, supports 1–10 tickets of one ticket type, and routes paid tickets to hosted Checkout. Free tickets bypass Stripe.
- A private database checkout record and pending registration rows reserve seats. Verified webhooks confirm paid tickets and record payment status; failures/expiry release the registration. Repeated requests reuse the same Checkout attempt.
- The admin payment list does not return Stripe session IDs to the browser.

Membership price applies to each ticket in that order. A buyer can select a quantity of one ticket type; a mixed-type basket is not implemented.

The working tree contains `drizzle/migrations/0005_hidden_ticket_payments.sql`. It is **not applied**. A read-only query on Supabase project `vlcssswzlvamtscyobbv` found no new payment schema/functions/columns and confirmed the existing active-registration index expected by this migration. I did not apply it before deployment because it replaces older registration RPC behavior.

Vercel currently has server-only entries for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `SITE_URL` in Production/Preview. Their values were not read or revealed. The local `.env` lacks the Stripe/service-role entries. The app rejects live Stripe keys for ticket checkout. The Stripe sandbox Workbench currently has no webhook destination. No end-to-end purchase/webhook has been tested; no payment has been taken and nothing has been deployed.

TypeScript and production build pass. Existing TanStack deprecation and bundle-size warnings remain unrelated to this integration.

## Required release steps

1. Claude reviews migration, permissions, webhook checks, and checkout/capacity edge cases. Codex fixes blockers on `codex-dev`.
2. After review is clean, deploy the new server code and apply migration 0005 in a coordinated release so the existing site does not run against replaced RPCs.
3. Add a **test-mode** Stripe webhook destination at `/api/public/stripe-webhook` on the chosen HTTPS deployment. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`.
4. Set only the test signing secret in the correct Vercel environment and use the deployed site as `SITE_URL`. Keep secrets server-only; do not paste them into chat or client variables.
5. Verify the runtime secret is a test-mode key without exposing its value. Run successful, declined, cancelled, duplicate-click, expiry, membership-price, and last-seat checks; confirm the resulting rows in Supabase and `/admin`.

Do not call checkout functional until a sandbox transaction has produced a webhook-confirmed registration. Live mode is a separate reviewed release.

## Product scope decisions

| Stripe product | Current scope / later decision |
| --- | --- |
| Payments | Sandbox Checkout for CometX event tickets. |
| Billing | Not enabled. Confirm subscription interval, renewals, cancellations and entitlement rules first. |
| Invoicing | Payment table can store invoice/receipt URLs; decide document and legal requirements before enabling invoice creation. |
| Connect | Not needed for CometX's own tickets. Consider only if third-party sellers/organizers receive payouts. |
| Terminal | Not enabled. Confirm in-person checkout/check-in needs before designing it. |
| Tax | Not enabled. Confirm product classification and tax treatment before configuring registrations or automatic tax. |
