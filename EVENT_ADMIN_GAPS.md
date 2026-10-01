# Event admin gap audit

**Audit date:** 2026-10-01
**Scope:** Initial audit of `cometx-codex` on `codex-dev`, updated for `codex/event-admin-phase-2a`; admin and public event, ticket, order, and account-ticket flows.
**Method:** Source and migration review plus focused implementation checks. Full customer/admin/backend requirements are preserved in `EVENT_SYSTEM_SPEC.md`.

## Master specification status

DONE means implemented and locally checked for the stated slice; it does not mean deployed or verified against the hosted database. PARTIAL means existing functionality does not cover the entire requirement. MISSING means the requested capability is absent from this branch. RELEASE BLOCKER marks prerequisites for production readiness.

| Requirement | Status | Remaining work / evidence |
| --- | --- | --- |
| Customer discovery/detail | PARTIAL | Existing event pages/content; upcoming/past discovery, availability and all buyer states need full runtime verification. |
| Customer/member pricing | PARTIAL | Server pricing and entitlements exist; verify actual plan rules and group-ticket benefit policy. |
| Multi-event cart | PARTIAL | Existing grouped cart; matching hosted schema and end-to-end checkout verification pending. |
| Buyer and attendee details | PARTIAL | Buyer/attendee separation exists; verify first/last names and legacy compatibility throughout checkout and issued tickets. |
| Checkout | PARTIAL | Existing contact/ticket/payment flow; required event policies/consents and complete review flow remain. |
| Payment and fulfillment | RELEASE BLOCKER | Pending migrations and missing full sandbox payment/webhook verification; free and failed/cancelled payment cases need verification. |
| Post-purchase / My CometX / guest access | PARTIAL | Confirmed-ticket and secure-link paths exist; delivery setup and full purchase/access verification pending. |
| Admin event list | PARTIAL | Phase 2A implemented; duplicate/cancel quick actions and separate publication/capacity list presentation remain. Metrics require server configuration. |
| Event workspace | PARTIAL | Overview, Orders and existing editor available here. Other operational sections remain. |
| Overview | DONE | Implemented Phase 2A, unavailable-metrics handling Phase 2B; live sales verification still blocked by server configuration. |
| Tickets management | PARTIAL | Existing ticket fields; dedicated workspace, archived-ticket management, sold counts and limits remain. |
| Settings | PARTIAL | Existing dates/capacity; checkout field configuration, consents, policies, message and order-limit settings remain. |
| Orders read workspace | DONE | Phase 3A: per-event server search/filter/pagination and expandable buyer/payment/issued-ticket details. Live database verification pending. |
| Orders actions / full discount history | MISSING | Resend, refund/cancel actions and original-price/discount snapshots remain. Current UI displays recorded price basis, not invented savings. Pre-issuance attendee names are not shown. |
| Guests/check-in/export | PARTIAL | Implemented separately on `codex/event-ops` (`ce82633`); not integrated here. Its migration `0010` and live check-in verification remain pending. Do not reimplement independently. |
| Per-event Emails | MISSING | Global backend confirmation delivery exists; per-event controls/content/delivery state remain. |
| Promotion | PARTIAL | Public/preview URLs exist; sharing tools, coupons, campaigns and sponsor connections remain. |
| Event analytics | MISSING | Event workspace reports/funnel/time series missing; never substitute invented traffic figures for unavailable GA4 data. |
| Backend/data separation | PARTIAL | Existing entities and server boundaries; verify complete ledger/fulfillment paths and reconcile branches. |
| No Lovable dependencies | RELEASE BLOCKER | This branch still has inherited build/preview dependencies. Cleanup exists on `codex/event-ops` (`f575dc7`); integrate/review separately. |
| Data safety / release | RELEASE BLOCKER | Transactional event save, pending schema release, capacity/payment verification and secure server configuration remain. |
| Event lifecycle | PARTIAL | Publication and operational states stored separately; complete operational transitions and cancellation policy/actions remain. |

## Executive summary

Event creation/editing, multiple ticket types, guest/member pricing, a multi-event cart, Stripe checkout, webhook fulfillment, and purchased-ticket views already exist. Phase 2A adds the requested event list management and per-event Overview. The remaining admin work is still substantial. The public purchase flow has foundations, but production readiness is not established: migrations `0007`–`0009` are pending in the connected Supabase project, and the Stripe test checkout/webhook flow has not had an end-to-end purchase verified.

## Admin target coverage

| Target area | Current state | Gap / impact |
| --- | --- | --- |
| **Event list** | `/admin/events` has title/slug search, lifecycle and event-type filters, image, lifecycle status, start date/time, location, ticket sales/revenue, last modified, and edit/view/preview/publish/unpublish/delete actions. Add event is available. If sales metrics are unavailable, event rows remain visible and unavailable values are shown as “—”. | Duplicate action is not available. Sales totals intentionally cover confirmed paid/free ticket orders and confirmed legacy registrations. Server-side metrics still require secure admin configuration; no staff-facing key or provider setup is shown. |
| **Event overview/detail** | `/admin/events/$id` opens an Overview tab with publication/registration states, preview/public URL, date/time/location/type/capacity, ticket count/capacity progress, confirmed revenue, five recent orders, and a setup checklist. Orders and the existing Edit event tab are available. If metrics are unavailable, event details and editing remain available while sales/order values are marked unavailable. | Guests integration, Tickets workspace, Settings, Emails, Promotion, and Analytics remain unfinished on this branch. Preview displays saved event data. |
| **Tickets** | The event form supports multiple active ticket types with public price, optional explicit member price or entitlement-based benefits, sale start/end, per-type capacity, and free/required/discount entitlements. Removed ticket types are marked inactive by save logic. Server-side pricing and checkout validation exist. | No sold count or capacity progress in the editor; no explicit early-bird pricing concept (a separately configured ticket/sale window is the available workaround); no archive/unarchive management for inactive ticket types. Stripe product/price synchronization runs in server code, but the save response exposes a generic “online payments are not ready” warning to staff when sync is unavailable, so the provider integration is not entirely invisible. |
| **Settings** | Event registration open/close dates and event status are editable. Checkout currently requests buyer and attendee names/email in the cart; server validation caps a basket at 10 tickets. | No per-event checkout-field configuration, per-ticket attendee-field configuration, configurable order limit, policy/consent configuration, event confirmation-message settings, or cancellation/refund policy controls. The 10-ticket limit is a code-level rule, not an event setting. |
| **Orders** | Event workspace now has an Orders tab with server-side search by buyer/email/full order UUID, status/buyer filters, exact count and pages of 20. Expandable detail shows event-only lines/issued attendees/ticket codes, recorded pricing basis, order/payment/refund/cancel states, creation date and full order total. Legacy single-event schema is supported. | Live data verification requires server configuration. Search does not include attendee names/ticket codes. Pre-issuance attendee names and historical numeric discount amounts are not displayed. Resend/refund/cancellation actions remain missing. Existing global `/admin/orders` still has its 500-order cap. |
| **Guests / attendees** | Attendee records and ticket codes are visible nested under orders. Buyer kind is stored as member/guest. | No dedicated per-event attendee roster, attendee search/filter, check-in control, member-vs-guest attendee view, contact link, or CSV export. The display says “Account holder” for signed-in buyers; that does not establish active membership. Existing attendee statuses include `checked_in`, but the admin UI does not provide check-in operations. |
| **Emails** | Guest ticket confirmation delivery is implemented server-side through Resend when required configuration is available. Resend settings are shown generically on the global integrations page. | No per-event email settings or staff controls for confirmation, reminders, cancellation/update, or post-event messages. Staff cannot enable/disable these event messages in event detail. Delivery configuration and retry/operational status are not surfaced as event operations. |
| **Promotion** | Public event URL/preview are available from the edit form. | No event coupon/discount management, newsletter campaign link, share controls, or event-linked GA4/conversion report link. |
| **Analytics** | Consent-aware GA4 helpers exist; checkout/purchase signal wiring is documented in `ANALYTICS.md`. | No per-event analytics view for views, funnel, orders, sales over time, gross/net sales, or capacity progress. The admin order page has a limited confirmed-revenue total but no event attribution analytics or funnel. |

## Public flow and backend coverage

| Capability | Current state | Remaining verification / gap |
| --- | --- | --- |
| Guest and member prices | Server code calculates the quote from ticket price and current membership entitlements; database reservation/checkout functions repeat membership and capacity checks. | Confirm configured member benefits and eligibility against the target release data. Do not rely on browser-calculated prices. |
| Multiple ticket types, quantities, cart | Event pages allow ticket selection; `/cart` supports multiple ticket lines/events, quantity changes, and attendee names per ticket. Basket limits and currency constraints are enforced. | The current documented checkout has no end-to-end production-like verification. |
| Stripe payment and ticket issuance | Stripe is handled server-side; signed webhook fulfillment is the confirmation path. `/account/events` shows purchased/issued tickets; guest tickets have a secure guest-access route. | `.ai/CONTEXT.md` and `DEVELOPMENT.md` report hosted migrations `0007`–`0009` pending and no complete sandbox checkout/webhook purchase verified. Release must coordinate code, migrations, environment configuration, and test-mode verification. |
| Supabase source of truth | Event, ticket, order, payment, and attendee data are stored/read through Supabase; Stripe is used for payment processing. Admin server functions require an admin. | `adminSaveEvent` performs event, speaker, ticket, and workshop writes as separate operations rather than one database transaction; failures after an earlier write can leave a partial save. A transactional save boundary and recovery behavior should be addressed before treating event editing as production-ready. |
| Stripe sync visibility | Provider calls are contained in server-side ticket payment code. | The event form receives `paymentSyncReady` and displays a warning when sync is not ready. Decide how staff should be informed of actionable availability while keeping Stripe mechanics hidden. |
| Refund/cancellation | Order statuses include cancelled/refunded and the order page reports them. | The UI explicitly states refund and cancellation actions are not enabled. Automatic refunds are also identified as unimplemented in the handoff history. Define staff action and provider/database reconciliation before enabling these statuses operationally. |

## Release and repository notes

- The active project is `cometx-codex`; the parent workspace is an older Next.js/Payload scaffold. The root-level `.ai/CONTEXT.md`, `.ai/TASKS.md`, and `.ai/HANDOFF.md` requested at the workspace root do not exist; the active app's `.ai` directory contains the applicable project guidance.
- `.ai/CONTEXT.md` says migrations `0007`–`0009` are pending in connected Supabase. `DEVELOPMENT.md` says no sandbox checkout/webhook purchase has been verified. This is a release blocker for claiming the entire public purchase flow production-ready, independent of admin UI gaps.
- `src/lib/events.functions.ts` has a pre-existing uncommitted event-capacity compatibility change tracked as `EVENT-READ-01`. This audit did not modify it.
- The active project has no `.ai/REVIEW.md`-based review finding added by this audit; this document is a product-scope gap inventory, not a code review.

## Phase 2A completion (2026-10-01)

- Implemented event-list search, lifecycle/event-type filters, image/title, start, location, sold count, confirmed revenue, last modified, and edit/view/preview/publish/unpublish/delete actions.
- Added server-side event sales summaries using ticket orders and confirmed legacy registrations. Metrics page through matching order rows, report confirmed order revenue by currency, and fall back to the pre-`0008` single-event ticket-order schema.
- Added an Overview/Edit event tab arrangement. Overview includes links, event facts, capacity progress, revenue, recent order summary, and setup completeness checks.
- Phase boundaries observed: no Orders or Guests pages/actions, ticket editor changes, Emails, Promotion, or Analytics work.
- Validation: `node node_modules/typescript/bin/tsc --noEmit` passed; `git -c core.whitespace=cr-at-eol diff --check` passed. No database/provider calls or app build were performed.
- Remaining event-list/detail work is described in the table above; continue with the separately assigned next phase.

## Phase 2B completion (2026-10-01)

- Event list and Overview now continue rendering event content if their separate server-side sales/order metrics cannot be loaded. Unavailable figures use an em dash; they are not presented as zero.
- Added staff-safe notices explaining that sales/order figures are unavailable while event details and publishing/editing remain available. Server-side configuration errors no longer tell staff to connect Lovable or expose environment variable names.
- No schema, event, order, payment, or provider data was changed. Server-side sales/order metrics remain unavailable until secure server configuration is supplied.
- Validation: TypeScript check passed. Runtime browser confirmation is pending because the visible port 3001 app belongs to a separate worktree; no service-role key is available in this worktree.

## Suggested implementation sequence

1. **Event operations foundation (remaining):** review/integrate the existing Guests/check-in/export work from `codex/event-ops`; coordinate server configuration and pending migrations for runtime verification. Orders read workspace is implemented here; safe resend/refund/cancel actions remain separate work.
2. **Ticket and event configuration:** improve ticket lifecycle/sold counts; add required checkout/attendee fields, configurable order limit, policies, confirmation/cancellation settings; make event/ticket saves transactional.
3. **Communications and promotion:** event-specific message controls and delivery visibility; coupons and newsletter/share links.
4. **Event analytics:** per-event views/funnel and sales/capacity reporting with clear data sources and GA4 links.
5. **Release verification:** coordinate pending migrations with matching code, verify server secrets and Resend readiness without exposing provider mechanics, and run a sandbox checkout through signed webhook fulfillment and purchased-ticket access.

This is an audit only. No feature implementation is included in Phase 1.

## Phase 3A completion (2026-10-01): per-event Orders

- Scope implemented: authenticated admin Orders tab, server-side buyer/email/full UUID search, order-status/buyer filters, exact-count pagination, and expandable order details with issued attendee/ticket records.
- Multi-event orders show only this event's lines/attendees and subtotal. Full order amount and payment state are explicitly labelled for all events. Signed-in buyers are not labelled active members; recorded member/included price basis is shown per line.
- Read-only implementation; no migration, provider operation, hosted data mutation, or other event phase. New endpoint authorizes admin before importing privileged data access; output explicitly excludes guest tokens and provider identifiers. Known legacy schema fallback preserves all filters and event scope.
- Checks: TypeScript passed; eight focused tests passed (event scoping, pagination/filtering, legacy fallback, failure behavior, search escaping, validation, admin denial before privileged import, and real component rendering).
- RELEASE BLOCKER: live staff/hosted-order checks remain pending because this preview lacks the server-only Supabase key. Error/retry state is explicit and never presented as an empty order history. Other-branch work is recorded above, not claimed as integrated.
