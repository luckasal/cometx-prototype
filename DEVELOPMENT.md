# Development status — 23 September 2026

## Update — 25 September 2026: hidden Stripe event checkout

The `codex-dev` branch now contains backend-only Stripe test Checkout for event tickets. Admin ticket edits sync Products/Prices; server checkout calculates membership pricing and holds capacity; a verified test webhook confirms registrations. Quantity supports up to ten tickets of one ticket type. Migration `0005_hidden_ticket_payments.sql` is not applied and the implementation is not deployed. Supabase production schema was checked read-only; Vercel secret variable names are configured, but values were not inspected. Stripe sandbox has no webhook destination yet. No payment was tested. See `STRIPE_INTEGRATION_PLAN.md` and `.ai/HANDOFF.md` for release steps.

Active application: this `imported-cometx` directory. The parent directory contains the earlier Next.js scaffold and is not the current application.

## Verified

- Imported TanStack Start application starts at http://127.0.0.1:3001.
- Existing Supabase connection works: events, plans, public articles and partners are present.
- Homepage loads real database rows; public data no longer requires a service-role key.
- Event details display the programme, speakers, workshops and trusted guest prices.
- Production build generates a Cloudflare worker and assets.
- Strict TypeScript check and 14 business/security tests pass.

## Improvements in this development pass

- Public and account reads use the public key and caller JWT with RLS.
- Future and expired memberships are excluded from benefits.
- Account query caches are cleared when the signed-in identity changes.
- Login/signup redirects are restricted to internal paths.
- Signup handles email confirmation instead of redirecting an unconfirmed user into the account.
- Gated previews return the approved excerpt, not a slice of the protected body.
- Stripe checkout destinations use server configuration and live-mode keys are rejected.
- Webhook signatures support key rotation; only paid test sessions are fulfilled.
- Migration 0002 adds atomic free reservations, database capacity checks and transactional, idempotent payment fulfillment.

## Not yet verified or complete

Migration 0002 is saved locally but has NOT been applied to the remote database. Free reservations and the new webhook require it. Existing migrations 0000/0001 appear to be represented in the configured database; do not rerun them there blindly.

The ZIP does not contain SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET. Admin mutations, privileged content previews and payment fulfillment need those values. SITE_URL is also required for checkout redirects. Configure values locally in .env; never paste or commit secrets.

No authenticated demo account was supplied or created, so login, admin CRUD and membership-based reservations have not been tested end to end. Pricing tests are unit tests, not proof that the migration has run.

Outstanding: paid checkout seat holds/expiry and refund handling if capacity fills before payment; storage uploads; password recovery; transactional admin event/ticket edits; full RLS/concurrency integration tests; repeatable demo-user provisioning; reconciliation of seeded example content with approved CometX content. Plans, partners, speakers and dates currently include imported demo data.

No deployment or changes to cometx.ch have been performed.
