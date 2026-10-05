# CometX CMS setup

Apply `drizzle/migrations/0003_cometx_cms_contacts_and_payments.sql` and then `drizzle/migrations/0004_event_publishing_workflow.sql` in the Supabase SQL editor after the existing migrations. They add the staff CMS tables, RLS policies, newsletter subscription RPC, event type/gallery fields, payment records, and the separate event publishing workflow.

Run `supabase/real-content-2026.sql` once after the core migrations to seed the three verified event images and retire the older demo event records without deleting registrations.

## Environment settings

Set these in Vercel for the production and preview environments:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` for Drizzle migration tooling; keep this database connection string server-side
- `CRON_SECRET` and optionally `CRON_SECRET_PREVIOUS` for authenticated scheduled requests
- `RESEND_API_KEY` when newsletter delivery is ready
- `RESEND_FROM_EMAIL` with a sender/domain verified in Resend, for guest ticket confirmations
- `GUEST_TICKET_TOKEN_SECRET` (at least 32 random characters) to sign/encrypt private guest ticket access links
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in **test mode only** for sandbox purchases
- `SITE_URL` set to the exact HTTPS site origin used for Checkout redirects and guest ticket links
- `VITE_GA_MEASUREMENT_ID` and/or `VITE_GTM_CONTAINER_ID` after analytics tags are added

When updating an existing deployment, rename any retired vendor-prefixed database-migration or cron-secret environment variables to the neutral names above before deploying. Secret values should remain in the hosting provider's server-only environment; never copy them into `VITE_*` variables or Git.

Migrations `0005_hidden_ticket_payments.sql` and `0006_ticket_orders_and_guests.sql` were applied to the CometX Supabase project in the earlier ticketing release. Before enabling the combined multi-event checkout, verify that `0007_multi_event_checkout.sql` is present, then apply `0008_single_multi_event_order.sql` followed by `0009_membership_event_pricing.sql` in order and deploy the matching app build as a coordinated release. `0007` adds the checkout/guest-access envelope; `0008` makes one order/payment cover all event lines, stores each named attendee separately, and issues one linked ticket per attendee. The Stripe **test-mode** webhook must point to `/api/public/stripe-webhook`. Verify one sandbox payment covering two events and a webhook replay before promoting. Do not enable live payments. Migration `0010_event_attendee_checkin_audit.sql` adds check-in time and staff actor fields; apply it only after the checkout migrations and before deploying the admin check-in UI. Do not enable live payments. Membership Billing, Connect, Terminal, automated tax and initiating refunds remain out of scope.

CometXXL membership checkout parity is implemented in the app but **not enabled in Supabase or Stripe until reviewed and configured**. Apply `drizzle/migrations/0011_cometxxl_membership_checkout.sql` only after migrations `0000`–`0010`; it sets CometXXL to CHF 250/year plus a one-time CHF 1.99 setup fee and stores the enrollment answers. Then use **Admin → Membership plans → Sync Stripe catalogue** with the sandbox key to create/associate the recurring annual Price and one-time setup Price. In the Stripe **test-mode** webhook, subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, and `customer.subscription.deleted`. In Stripe Billing Portal test settings, allow customers to cancel subscriptions; verify a test purchase, cancellation, subscription status update and webhook replay before enabling this flow publicly. The membership form requires email, nationality, motivation and feedback on what is missing; CometXXL renews annually until canceled. Do not apply this CometXXL billing promise to other tiers. No migration or Stripe dashboard setting has been changed by this code task.

Guest checkout uses a secure return link even while `TICKET_EMAIL_MODE=disabled`. To email that link after paid/free issuance, verify a sending domain and configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the enabled ticket-email mode. Keep `GUEST_TICKET_TOKEN_SECRET` stable: rotating it does not invalidate existing access links (the database stores a token hash), but it prevents email delivery for older unmailed orders whose token was encrypted with the previous key.

For optional guest-to-account linking, allow the deployed `/tickets/guest` return URL in Supabase Auth's redirect URL allowlist so new-account confirmation can return to the secure order link.

## Staff workflow

- Use **Events** for event details, registration windows, speaker assignment and ticket capacity/pricing. Save a draft, preview it privately, publish it, or unpublish it without losing event data or registrations.
- Use **Contacts** for newsletter/event leads. A contact can link to an authenticated member but does not create an account or membership.
- Use **Content** for videos, galleries, opinions, open positions and symposium entries; articles retain their existing editorial workflow.
- Use **Settings** to verify whether the optional integration environment variables are present. Secrets never appear in the admin UI.
