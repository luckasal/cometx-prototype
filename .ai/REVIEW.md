# CometX review log

Thread C (or an assigned reviewer) records findings against a branch and commit. Use **BLOCKER** for unsafe or broken behavior that prevents release, **IMPORTANT** for significant defects or maintainability/security risks to fix before merge, and **NICE TO HAVE** for non-blocking improvements. Include file/line, evidence, impact, and recommended fix. Mark resolved findings with the fixing commit; do not erase historical findings.

## Historical self-review (predates the multi-Codex-thread workflow)

Reviewed branch: `codex-dev`
Reviewed commits: `96f7e0ae95a7b0c0bb9c8a1bb8358d445e33e745` and `0133387fcafee59975c863c9332b7bfeb1b35255`
Status: Code review completed; release is blocked on coordinated database/deployment setup and missing guest-email configuration.

## BLOCKER

- Production Supabase does not yet have the payment/order schema: read-only SQL confirmed `ticket_payment_products`, `ticket_orders`, and `ticket_attendees` are absent. Migrations `0005_hidden_ticket_payments.sql` and `0006_ticket_orders_and_guests.sql` must be applied together with the matching app release. Applying 0005 first changes `register_prototype_ticket` to reject the older production client; deploying the new client first makes event reads depend on 0006 tables. Schedule a coordinated release and verify checkout immediately after.
- Guest checkout requires a stable server-only `GUEST_TICKET_TOKEN_SECRET`. Email verification is no longer a staging blocker: `TICKET_EMAIL_MODE=disabled` retains secure guest links without claiming email delivery. Enable email only with verified sender and API key.

## IMPORTANT

- The latest `codex-dev` build is a Vercel Preview, not the live Production deployment. Vercel's public Supabase variables are Production-only, so this Preview cannot reach events. Keep that separation; do not point Preview at Production just to test it. Use a separately isolated database or test after the coordinated Production release.
- Follow-up self-review fix: Stripe ticket products are now active only while the event and ticket sale windows are open; completed/closed events are archived on the next admin save/sync instead of appearing as sellable products.
- All migrations executed successfully in isolated PGlite PostgreSQL on 2026-09-27. Guest/contact separation, paid fulfillment replay, mixed-line capacity rejection and service-only RPC grants pass. Fixed partial issuance before a later capacity failure. Real Supabase concurrency, free issuance and failed/expired Stripe delivery still need release validation.
- Member pricing/free entitlements currently apply to every ticket in a member's basket. Confirm this business rule before treating group purchases as final.

## NICE TO HAVE

- Admin order/revenue listing is capped at the latest 500 orders; use database-side aggregation/pagination if volume grows.

## 2026-10-02 Vercel demo browser QA

Reviewed target: `https://cometx-prototype.vercel.app`, Production alias, deployment source branch `codex/integration-release-20261002`. Read-only UI checks; no transactional/admin mutations. Full route notes are in `VERCEL_QA_AUDIT.md`.

### BLOCKER

- Public event discovery and purchase cannot currently be completed on the demo: `/events` remained at “Loading events…” after 5 seconds; `/events/emocni-regulace-v-kazdodenni-praxi?preview=false` remained at “Loading event…” after 4 seconds. The user’s supplied event screenshot independently shows “Server-side data access is temporarily unavailable.” Cart also remained at “Loading tickets…”, displayed no totals, and its payment CTA was disabled despite a two-ticket header count. Reproduce and diagnose the server-function/Supabase response and client loading-state handling; make failure visible/retryable instead of infinite loading. Do not start live-payment testing until this is resolved.

### IMPORTANT

- Homepage community module (`/`), stories (`/community`), and partner data (`/partners`) remained in loading states after 4 seconds; static page copy/links rendered. Confirm their read functions and error handling.
- `/account` and `/account/events` rendered the signed-in account shell but left ticket/event data loading. `/admin/payments` likewise remained loading. Admin event rows were available, but sales totals and per-event sold/revenue were unavailable (`—`). These prevent users/staff from trusting ticket/payment reporting.
- Membership cards and prices loaded, but the page explicitly says online checkout will be available soon; end-to-end membership purchase is not implemented/verified on the deployed site.

### NICE TO HAVE

- `/admin/analytics` shows a preview state rather than verified live GA4 reporting. Confirm GA4 server/property configuration before relying on the dashboard.
