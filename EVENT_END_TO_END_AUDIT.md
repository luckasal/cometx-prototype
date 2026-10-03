# CometX events: end-to-end audit

Checked 3 October 2026 against the Vercel demo, current `codex/integration-release-20261002` code, and isolated PostgreSQL migration tests. This is a release-readiness audit, **not** proof of a successful paid purchase. `cometx.ch` remains the separate Wix site.

| Stage | Customer / staff experience | Evidence and current state | Action |
| --- | --- | --- | --- |
| Discovery | Public event list, upcoming/past cards | `/events` loaded six published events in the demo. | Keep; verify mobile and slow-network states before release. |
| Event detail | Content, speakers, ticket types, availability | Published workshop rendered editorial content and two ticket types. Its regular ticket was disabled because sale starts 30 Nov 2026; the early-bird ticket sells until then. The page did not explain this. | **Fixed in this branch:** shared availability reason on event detail and cart; admin ticket editor shows current sale state. |
| Lifecycle | Draft/preview, publication, event date, sale windows | Preview disables buying. A past event left in `registration_open` could previously appear bookable even though checkout SQL rejects it. | **Fixed in this branch:** public registration state closes at event start. Admin now validates event and registration date ordering on both form and server. |
| Ticket selection | Multiple types and quantities | Cart supports editable quantities and attendee names; UI totals use server-returned ticket prices. This is not a server-side purchase quote. | Keep; server must continue to re-quote every line. |
| Cart/contact | Guest/member buyer, one attendee per ticket, mixed events | Demo cart loaded two Beer POTLA.CH tickets and buyer fields. Code supports grouped events and attendee names. | Perform real guest/member form tests on an isolated test environment. |
| Payment start | One Stripe test Checkout for all cart lines | Code creates one session with internal order metadata and server-created prices. Hosted schema previously lacked `ticket_order_items.event_id` from migration `0008`; batch checkout therefore cannot be certified there. | **BLOCKER:** review/apply migrations `0007`–`0010` in order, then test against the matching deployment. Do not accept a purchase on the current demo as verified. |
| Fulfilment | Signed webhook, one issued ticket per attendee, replay safety | Webhook verifies Stripe signature and returns non-2xx on DB failure. Isolated PostgreSQL test passes migration chain, replay and mixed-line capacity rejection. | **BLOCKER:** run sandbox Checkout, success/failure/expiry/replay/concurrent-seat tests with the actual Supabase and webhook endpoint. No paid E2E transaction was run in this audit. |
| Confirmation | Account and secure guest access | Account route lists only owned/issued tickets; guest token access exists. Email is disabled by default pending verified Resend sender. | **IMPORTANT:** verify member ticket display and guest link recovery; enable transactional email only after domain verification and delivery tests. |
| Admin event setup | Editor, tickets, publication, preview | Demo editor exposes ticket price/capacity/sale dates and content. It now shows current ticket sale state. | **IMPORTANT:** event save spans multiple DB writes and is not atomic. Move event/ticket/speaker/workshop save into one transaction/RPC before relying on it for high-volume operations. |
| Admin operations | Orders, attendees, check-in, reporting | Orders/roster/check-in code exists, but the Guests tab was not wired to the roster. Editor has placeholder Emails, Promotion and Analytics tabs. Migration `0010` adds check-in audit fields. | **Fixed in this branch:** Guests now renders its attendee roster. Verify against migrated Supabase; build meaningful tabs or remove placeholders. Refund/cancellation operations need an explicit product policy and implementation. |
| Policies | Purchase consent and event-specific terms | Checkout links to existing CometX terms/privacy PDFs. Event-specific policy text is not stored, so no invented text is shown. | **IMPORTANT:** approve/version event policy content and record accepted version with the order before promising event-specific consent. |
| Analytics | Discovery through confirmed purchase | Events are instrumented, and purchase tracking waits for owned/confirmed order data. Admin GA4 reporting currently has a blank preview state. | Configure/report-test GA4 separately; do not use client clicks as revenue evidence. |

## Coordinated release sequence

1. Snapshot the connected Supabase project and review `0007`–`0010`, especially `0009`'s membership entitlement rewrite. Test on a separate Supabase staging database first; isolated PGlite tests are necessary but not sufficient for RLS, concurrency and deployed auth.
2. Apply migrations in order, deploy matching code to the Vercel **demo only**, and verify Stripe **test** key, webhook destination/signature, `APP_URL`/`SITE_URL`, and guest-token secret without exposing values. Do not switch to live keys or `cometx.ch`.
3. Exercise: guest public-price purchase; signed-in member discount/free entitlement; two ticket types; two different events in one payment; three attendees; sold-out race; cancelled/failed/expired payment; duplicate webhook; guest link/account tickets; admin order, revenue, attendee and check-in views.
4. Verify confirmation email after Resend domain setup. Until then, a guest who loses the secure return URL has no reliable email recovery.
5. Only after this matrix passes, consider the checkout ready for customers. Rotating the previously exposed Supabase server credential remains a separate security action.

## Known limitations not silently papered over

- Current demo data and code do **not** prove a successful paid transaction. No payment was initiated here.
- Member benefits are applied to all tickets in a member's basket; CometX must confirm that policy before final release.
- Coupon/gift-card, refunds and event-specific terms have no verified data/behavior; no fake customer controls were added.
- Some old unit tests for the event template target an obsolete component API and need modernization before the full suite is trusted.
- This worktree lacks a complete local `node_modules`, so typecheck/build were not run here. Focused pure-code and isolated database tests passed; run build/typecheck in a fully installed checkout before deploy.
