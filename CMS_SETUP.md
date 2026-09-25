# CometX CMS setup

Apply `drizzle/migrations/0003_cometx_cms_contacts_and_payments.sql` and then `drizzle/migrations/0004_event_publishing_workflow.sql` in the Supabase SQL editor after the existing migrations. They add the staff CMS tables, RLS policies, newsletter subscription RPC, event type/gallery fields, payment records, and the separate event publishing workflow.

Run `supabase/real-content-2026.sql` once after the core migrations to seed the three verified event images and retire the older demo event records without deleting registrations.

## Environment settings

Set these in Vercel for the production and preview environments:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` when newsletter delivery is ready
- `RESEND_FROM_EMAIL` with a sender/domain verified in Resend, for guest ticket confirmations
- `GUEST_TICKET_TOKEN_SECRET` (at least 32 random characters) to sign/encrypt private guest ticket access links
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in **test mode only** for sandbox purchases
- `SITE_URL` set to the exact HTTPS site origin used for Checkout redirects and guest ticket links
- `VITE_GA_MEASUREMENT_ID` and/or `VITE_GTM_CONTAINER_ID` after analytics tags are added

The guest/member ticket-order code is on `codex-dev`; migrations 0005 and 0006 are not applied and checkout is not deployed. After Claude review is clean, apply migrations 0005 then 0006 and deploy the matching code as one coordinated release. Migration 0005 replaces older ticket-registration RPCs; 0006 adds private orders, contacts linked without newsletter consent, ticket items/attendees and guest ticket access. Never apply either migration independently to Production while the old app is running. Configure the Stripe test webhook at `/api/public/stripe-webhook` after the reviewed release. Do not enable live payments. Membership Billing, Connect, Terminal, automated tax and initiating refunds remain out of scope.

Guest checkout is disabled until `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured, so the promised guest access email can be delivered. Resend confirmation is sent after paid/free issuance. Keep `GUEST_TICKET_TOKEN_SECRET` stable: rotating it does not invalidate existing access links (the database stores a token hash), but it prevents email delivery for older unmailed orders whose token was encrypted with the previous key.

For optional guest-to-account linking, allow the deployed `/tickets/guest` return URL in Supabase Auth's redirect URL allowlist so new-account confirmation can return to the secure order link.

## Staff workflow

- Use **Events** for event details, registration windows, speaker assignment and ticket capacity/pricing. Save a draft, preview it privately, publish it, or unpublish it without losing event data or registrations.
- Use **Contacts** for newsletter/event leads. A contact can link to an authenticated member but does not create an account or membership.
- Use **Content** for videos, galleries, opinions, open positions and symposium entries; articles retain their existing editorial workflow.
- Use **Settings** to verify whether the optional integration environment variables are present. Secrets never appear in the admin UI.
