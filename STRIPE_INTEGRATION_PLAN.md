# CometX Stripe sandbox plan

## Status — 25 September 2026

This is a repository review and plan based on the official `stripe-best-practices` skill, not output from `stripe_implementation_planner`. The Claude CLI is not installed. A Stripe plugin connection was offered; the Stripe MCP endpoint was added to Codex, but OAuth timed out while awaiting user sign-in. The planner remains unavailable. The official skill was installed as the requested fallback.

No live payments are enabled. Current event registration is an unpaid prototype reservation, not a completed purchase. Repaired ticket records do not change that.

## Phase 1: sandbox event checkout

- Use a dedicated CometX Stripe sandbox and hosted Checkout Sessions for one-off event tickets. Keep the existing Supabase event, ticket and membership records authoritative.
- Server authenticates the user, checks publication, registration dates, ticket availability and entitlements, then computes the price. Never accept a client-supplied amount.
- Before taking payment, create an atomic, expiring seat hold in PostgreSQL covering both event and ticket capacity. Persist the trusted amount/currency, user, ticket and checkout attempt ID. Repeated clicks must reuse an idempotent attempt, not create duplicate payments.
- Use a server-only restricted sandbox API key with the required permissions. Keep credentials in ignored local environment files and Vercel sensitive environment variables. Never put keys in `VITE_*`, source control, logs or chat.
- Create the Checkout Session with an idempotency key and an expiry aligned with the hold. Store its ID. Handle API timeouts by reconciling the same attempt before retrying.
- Fulfil only from a signature-verified webhook after confirming test mode, paid status, expected amount/currency and persisted checkout ownership. The success page only displays/rechecks database state; it never confirms a ticket itself.
- Make webhook delivery replay-safe. Handle completed, asynchronous success/failure and expiry; release failed/expired holds safely and record payment state. For delayed payment methods, define hold/reconciliation behavior before enabling them.
- Persist Stripe payment/session/customer and invoice/receipt references in the existing payment structure; show the resulting registration in `/account` and `/admin`.
- Test successful payment, decline, cancellation, duplicate clicks, webhook retries, forged metadata, expired sessions, last-seat concurrency and member pricing. Do not call checkout functional until a sandbox transaction and webhook-persisted registration have been verified.

## Existing integration review

`src/lib/stripe.server.ts` already creates Checkout Sessions and rejects live keys; the event action does not call it. `src/routes/api/public/stripe-webhook.ts` verifies signatures and calls an idempotent fulfilment RPC for paid test events. These are useful foundations, not a finished checkout.

Blocking gaps before enabling purchase: no pre-payment seat hold; no persistent checkout attempt/idempotency key; no asynchronous failure/expiry recovery; incomplete payment/invoice persistence; and the existing fulfilment migration checks legacy event status rather than the complete current publication/registration model. Reconcile older prototype reservations explicitly, rather than charging or overwriting them automatically. Revalidate existing RPC/schema state before a migration.

## Other requested Stripe products

| Product | CometX use / decision needed |
| --- | --- |
| Payments | First phase: hosted sandbox checkout for event tickets. |
| Billing | Membership subscriptions after staff confirm billing intervals, renewal/cancellation and entitlement rules. Use subscription/invoice webhooks, not a hardcoded one-year grant. |
| Invoicing | Determine which purchases require invoices versus receipts; link Stripe documents to payment records. Do not infer legal invoice requirements. |
| Connect | Only add if CometX pays independent sellers/organisers. Confirm merchant, settlement and liability model before creating connected accounts. Not required merely to sell CometX's own tickets. |
| Terminal | Separate in-person payment workflow; start with a simulated reader after confirming check-in/POS needs. No physical hardware purchase in this task. |
| Tax | Inspect account settings and confirmed registrations; obtain confirmed product classification and tax treatment. Do not enable automatic tax or create tax registrations based on the nonprofit label. |

## Configuration / next actions

1. User signs into Stripe and authorizes the CometX sandbox connection. Restart MCP OAuth (`codex mcp login stripe`) because the previous request expired; reload tools/session afterward and use the planner if available.
2. Configure server-only `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and the correct `SITE_URL` for each environment. Do not reuse production webhook secrets in previews.
3. Implement/review the checkout hold and payment-state migration before enabling the buy button. Apply it to the intended Supabase project after inspecting existing schema.
4. Register a sandbox webhook at `/api/public/stripe-webhook` on the chosen HTTPS deployment; test delivery, fulfilment and replay protection end-to-end.
5. Keep live charging disabled. Enabling live mode is a separate reviewed task.

References: [Stripe MCP](https://docs.stripe.com/mcp), [Checkout](https://docs.stripe.com/payments/checkout), [fulfilment](https://docs.stripe.com/checkout/fulfillment), [webhooks](https://docs.stripe.com/webhooks), [sandboxes](https://docs.stripe.com/sandboxes).
