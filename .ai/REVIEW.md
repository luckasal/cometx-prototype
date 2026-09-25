# Codex self-review (requested because Claude review is unavailable)

Reviewed branch: `codex-dev`
Reviewed commits: `96f7e0ae95a7b0c0bb9c8a1bb8358d445e33e745` and `0133387fcafee59975c863c9332b7bfeb1b35255`
Status: Code review completed; release is blocked on coordinated database/deployment setup and missing guest-email configuration.

## BLOCKER

- Production Supabase does not yet have the payment/order schema: read-only SQL confirmed `ticket_payment_products`, `ticket_orders`, and `ticket_attendees` are absent. Migrations `0005_hidden_ticket_payments.sql` and `0006_ticket_orders_and_guests.sql` must be applied together with the matching app release. Applying 0005 first changes `register_prototype_ticket` to reject the older production client; deploying the new client first makes event reads depend on 0006 tables. Schedule a coordinated release and verify checkout immediately after.
- Guest checkout correctly fails closed, but is unavailable until `RESEND_FROM_EMAIL` and `GUEST_TICKET_TOKEN_SECRET` are set in Vercel. The key names are absent in the Vercel project settings; do not enable guest checkout until an already verified CometX sender is selected and the guest secret is securely configured.

## IMPORTANT

- The latest `codex-dev` build is a Vercel Preview, not the live Production deployment. Vercel's public Supabase variables are Production-only, so this Preview cannot reach events. Keep that separation; do not point Preview at Production just to test it. Use a separately isolated database or test after the coordinated Production release.
- Follow-up self-review fix: Stripe ticket products are now active only while the event and ticket sale windows are open; completed/closed events are archived on the next admin save/sync instead of appearing as sellable products.
- SQL migration was statically reviewed but not parsed or executed locally; no PostgreSQL CLI was available. Run it first in a disposable Supabase database, then verify RLS/grants, free issuance, paid webhook fulfillment, failed/expired sessions and capacity contention before broad release.
- Member pricing/free entitlements currently apply to every ticket in a member's basket. Confirm this business rule before treating group purchases as final.

## NICE TO HAVE

- Admin order/revenue listing is capped at the latest 500 orders; use database-side aggregation/pagination if volume grows.
