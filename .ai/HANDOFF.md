# Agent handoff

Update this at the end of each implementation cycle. Keep entries short and factual.

## 2026-10-01: platform tooling cleanup

- Task completed: `PLATFORM-CLEANUP-01` — removed inherited platform-specific build/auth-preview/error-reporting wiring and standardized this checkout on pnpm.
- Branch / implementation commit: `codex/event-ops` / `f575dc7`.
- Files changed: `AGENTS.md`, `README.md`, `SETUP.md`, `package.json`, `pnpm-lock.yaml`, removed `bun.lock` and `bunfig.toml`, `.env.example`, `CMS_SETUP.md`, `drizzle.config.ts`, `vite.config.ts`, `src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/client.server.ts`, `src/integrations/supabase/client.ts`, `src/integrations/supabase/cron-auth.ts`, removed `src/integrations/supabase/previewAuthStorage.ts` and `src/lib/lovable-error-reporting.ts`, `src/routes/__root.tsx`, `.ai/TASKS.md`.
- Tests/checks run: TypeScript `tsc --noEmit` passed; production `vite build` passed; focused analytics/event/ticket tests passed (19/19); `git diff --check` passed. Full test suite has 4 existing environment/runtime failures: Node 22 strip-only TypeScript cannot parse a parameter property in `StripeRequestError`; isolated render tests cannot resolve React from a `data:` URL; PGlite test runtime dependency is absent. Other tests passed.
- Decisions: Supabase browser sessions now use standard `localStorage`; Vite directly configures TanStack Start, Tailwind, React and Nitro, retaining the previous Cloudflare-module build target. Migration and cron secret names are now `SUPABASE_DB_URL`, `CRON_SECRET`, and optional `CRON_SECRET_PREVIOUS`. Secret values were not read, copied, or changed. Hosting environment settings were not inspected or changed.
- Known issues: if hosting still uses retired environment variable names, scheduled jobs or Drizzle migration commands will need the new names before use. The full test-suite runtime issues listed above remain.
- Exact next recommended task: verify any existing hosting-side migration/cron variables and rename them to the neutral names above if needed; then deploy only after confirming the hosting target matches the retained Nitro preset.
## 2026-10-01: nine-tab workspace UI

- Task `EVENT-WORKSPACE-UI`, implementation commit `9aac624`, branch `codex/event-admin-phase-2a`.
- Files: `src/components/admin/EventForm.tsx`, `src/routes/admin.events.$id.tsx`, `EVENT_ADMIN_GAPS.md`, `.ai/TASKS.md`, and this handoff.
- Added requested navigation order: Overview, Tickets, Settings, Orders, Guests, Emails, Promotion, Analytics, Edit content. Overview/Orders remain functional; unimplemented sections use honest informational shells.
- Existing ticket controls are shown under Tickets; registration/status/event capacity under Settings; content/date/location/speakers/programme/featured under Edit content. A single continuously mounted EventForm preserves editor state between tabs and uses the existing save payload/actions. New-event form retains all sections. Backend code, schema and provider behavior unchanged.
- Ticket removal retains archive-on-save semantics and now explains it. No fabricated sold/remaining/revenue counts or editable settings without persistence; unsupported per-ticket reporting/archive restoration and checkout/policy/message settings are explicitly recorded as gaps.
- Checks: TypeScript passed; scoped/staged whitespace checks passed. Reviewed the focused diff to confirm form state/mutations/payload are unchanged. No live saving or browser interaction verification performed; no hosted data changed.
- Pre-existing `src/routeTree.gen.ts` change remains unstaged. No deployment or migration.
- Next phase requires a new instruction; follow user P0 priorities. Guests implementation exists on the separate event-ops branch and must be reviewed/integrated rather than duplicated. Unsupported settings/ticket reporting require a separate backend phase.

## 2026-10-01: Phase 3A — event Orders workspace

- Task: `EVENT-ADMIN-3A`; branch/worktree `codex/event-admin-phase-2a` / `cometx-event-admin-phase-2a`.
- Implementation commit: `a6b071b`.
- Files: `src/components/admin/EventOrders.tsx`, `src/lib/event-orders.ts`, `src/lib/event-orders.server.ts`, `src/lib/event-orders.functions.ts`, `src/routes/admin.events.$id.tsx`, `tests/event-orders.test.mjs`, `EVENT_SYSTEM_SPEC.md`, `EVENT_ADMIN_GAPS.md`, `.ai/TASKS.md`.
- Added read-only Orders tab: buyer/email/full-reference search, status/buyer filters, exact count and database pagination, expandable buyer/payment/issued-ticket details. Multi-event orders expose only selected-event lines/attendees; full order total/payment state are labelled separately. Recorded member/included price basis is shown without inventing discount amounts or membership status.
- Admin authorization runs before privileged module imports. Explicit field projection excludes guest tokens/provider IDs. Known legacy line-event schema errors retry with parent-event scope; other failures show an error/retry state, never an empty history.
- Checks: TypeScript passed; 8 focused tests passed, including authorization boundary, event isolation, pagination, legacy fallback, filter escaping and real component rendering; focused ESLint and staged whitespace checks passed.
- No migrations, hosted data writes, provider calls, or production deployment. Runtime staff/order verification remains pending: local preview lacks server-only Supabase key and the current browser is on login. Pre-issuance attendee names, numeric historical discounts, resend/refund/cancel actions remain gaps.
- Master spec preserved verbatim in `EVENT_SYSTEM_SPEC.md`; audit now labels DONE/PARTIAL/MISSING/RELEASE BLOCKER and distinguishes other-branch work. Guests/check-in/export exists on `codex/event-ops` (`ce82633`); platform cleanup exists there (`f575dc7`). Neither is integrated here. A coordination message failed with “thread not found”; committed task-board ownership was inspected and no active Orders task was recorded.
- Pre-existing generated `src/routeTree.gen.ts` change remains unstaged.
- Exact next phase: review/integrate existing Guests/check-in/export from `codex/event-ops`, coordinating its pending migration and hosted checks. Do not rebuild it independently or start automatically.

## 2026-10-01: event admin remains useful without metrics

- Task: `EVENT-ADMIN-2B` — keep event list and Overview available when server-side sales/order metrics cannot load.
- Files changed: `src/lib/admin.functions.ts`, `src/routes/admin.events.index.tsx`, `src/routes/admin.events.$id.tsx`, `src/integrations/supabase/client.server.ts`, `EVENT_ADMIN_GAPS.md`, `.ai/TASKS.md`.
- Implementation commit: `e5fb3ce`.
- Result: event content no longer disappears when metrics fail; unknown ticket/revenue/order values are shown as unavailable, not zero. Staff receive a neutral message and no Lovable or server-key setup instructions.
- Checks: `node node_modules/typescript/bin/tsc --noEmit` passed; focused `git -c core.whitespace=cr-at-eol diff --check` passed. No database, payment provider, migration, or production data changes.
- Known issue: sales/order totals remain unavailable until the server-only Supabase admin key is configured securely. Runtime UI verification is pending: the screenshot's port 3001 server is the separate `cometx-event-ops` worktree; this commit is on `cometx-event-admin-phase-2a`. The generated `src/routeTree.gen.ts` modification was pre-existing and left unstaged.
- Exact next task: after review, verify the Phase 2A worktree `/admin/events` with a staff session, then implement a separate Orders/Guests phase from the audit.

## 2026-10-01: local backoffice sign-in diagnosis

- Task: `LOCAL-AUTH-01` — restore `/admin` in the Phase 2A local preview.
- Files changed: `.ai/TASKS.md`, `.ai/HANDOFF.md` (task tracking only; no app source change remains).
- Tracking commit: `088d170`.
- Result: verified the global client middleware sends an Authorization bearer header. Server validation now uses the Supabase URL/public key taken from the already-running CometX client configuration and was run with Supabase network access; the current browser token is rejected with `AuthSessionMissingError` (stale/revoked for that Auth project). The login page is open at `http://127.0.0.1:3004/login?redirect=%2Fadmin` for a fresh manual sign-in.
- No production data was changed; no credentials or tokens were printed or saved. No application source changes remain from diagnostics.
- Blocker: this worktree has no local `SUPABASE_SERVICE_ROLE_KEY`; Phase 2A event sales metrics use the server-only key, so the event list needs that secret supplied through the existing secure local environment after sign-in. Do not put it in chat or commit it.
- Validation: local route responded HTTP 200; browser reproduced AuthSessionMissingError, then confirmed the clean login screen. No test suite was run.
- Exact next task: fresh sign-in on port 3004, then verify `/admin/events` with the server-only Supabase key available in the local server environment.

## 2026-10-01: event admin Phase 2A — list and overview

- Task completed: `EVENT-ADMIN-2A` — event list search/filters, sales summary and quick actions; per-event Overview tab alongside the existing editor.
- Files changed: `src/routes/admin.events.index.tsx`, `src/routes/admin.events.$id.tsx`, `src/lib/admin.functions.ts`, `src/lib/event-admin.ts`, `src/lib/event-admin-metrics.server.ts`, `EVENT_ADMIN_GAPS.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md`.
- Validation: `node node_modules/typescript/bin/tsc --noEmit` passed. `git -c core.whitespace=cr-at-eol diff --check` passed. No app build, database/provider operation, or runtime UI session was run.
- Decisions: order-ledger ticket/revenue totals count confirmed paid/free order lines and confirmed legacy registrations; revenue is grouped by currency. Recent orders display five rows. Metrics support the pre-`0008` single-event order-line schema. Lifecycle filters prioritize completed/cancelled over publication state; the Overview shows publication and registration status separately.
- Known issues: event list metrics require ticket-order tables from migration `0006`, which the active project context says are applied. Hosted `0007`–`0009` and checkout verification remain pending. Duplicate-event action and all excluded detail sections remain unimplemented.
- Implementation commit: `2dc4fd5`.
- Exact next task: continue with the remaining event operations scope in `EVENT_ADMIN_GAPS.md`, with Orders/Guests separated from Tickets/Settings/Emails/Promotion/Analytics as requested.

## 2026-10-01: event operations Phase 2B — attendee roster, check-in and export

- Task completed: `EVENT-OPS-2B` — added an event-scoped attendee roster to the event admin page with search, status filtering, ticket counts, CSV export and admin check-in.
- Branch / implementation commit: `codex/event-ops` / `ce82633`.
- Files changed: `src/routes/admin.events.$id.tsx`, `src/lib/admin.functions.ts`, `src/lib/event-attendees.ts`, `tests/event-attendees.test.mjs`, `drizzle/migrations/0010_event_attendee_checkin_audit.sql`, `CMS_SETUP.md`, `EVENT_ADMIN_GAPS.md`, `.ai/TASKS.md`.
- Migrations: added `0010_event_attendee_checkin_audit.sql`; not applied. It must follow coordinated migrations `0007`–`0009`, which remain pending in the connected Supabase project.
- Tests/checks run: focused attendee tests (2/2), TypeScript `tsc --noEmit`, production Vite build, and `git -c core.whitespace=cr-at-eol diff --check` passed.
- Known issues: no Supabase migration, browser flow, or sandbox payment/check-in was performed. The roster includes issued order attendee records only; legacy registrations without issued ticket records are excluded. Do not deploy the UI until migrations and the matching build are coordinated.
- Exact next recommended task: review the `0007`–`0010` migration sequence and verify sandbox checkout/webhook issuance plus per-event check-in in the target environment; then address legacy registrations and per-event order detail/guest operations.

## 2026-10-01: preserve post-login return route

- Task completed: `AUTH-REDIRECT-01` — password login now returns through TanStack client-side navigation to the validated `safeReturnPath`, keeping the live auth provider state during protected-route navigation.
- Branch / implementation commit: `codex/event-ops` / `f9ce7c7`.
- Files changed: `src/routes/login.tsx`, `.ai/TASKS.md`.
- Tests/checks run: TypeScript `tsc --noEmit` passed; focused attendee tests passed. An additional `business.test.mjs` attempt could not run under Node 22 strip-only TypeScript because an imported Stripe client uses unsupported parameter-property syntax. No credentials were entered and no authenticated redirect was end-to-end tested.
- Known issues: the browser still requires the user to complete sign-in again after this hot update; no admin/database authorization is bypassed. The local server uses the existing non-secret Supabase public configuration only; no server secret was added.
- Exact next task: sign in once at local `/login?redirect=%2Fadmin%2Fevents`, verify arrival at the event list, and confirm staff access before opening a particular event's Attendees tab.

## 2026-10-01: local account session verification

- Task completed: `AUTH-LOCAL-02` — restored local server access to Supabase Auth so a persisted browser session is validated server-side instead of being misreported as signed out.
- Branch / state: `codex/event-ops`; no source-code or database change. Restarted the local Vite process on port 3001 with outbound network enabled, using only existing public Supabase configuration.
- Verification: refreshed `/account`; it displayed the authenticated account overview and staff access card. A read-only Supabase Auth health request returned HTTP 200 with network access; the same request was blocked by the sandbox.
- Known issue: the dev server must be started in an environment allowed to reach Supabase. Starting it in a network-restricted sandbox reproduces the false signed-out state. No service-role key was loaded or used for this verification.
- Exact next task: continue event admin verification with the user on the already authenticated local account; coordinate pending migrations before testing check-in or deploying.

## 2026-10-01: multi-Codex-thread collaboration setup

- Task completed: `SETUP-01` — updated the existing repository instructions, shared context, task board, review format, and this handoff for independent Codex threads.
- Files changed: `AGENTS.md`, `.ai/CONTEXT.md`, `.ai/TASKS.md`, `.ai/REVIEW.md`, `.ai/HANDOFF.md`.
- Commit hash: `ba73cd8` (workflow/context/task/review changes); this handoff is recorded in the following commit.
- Tests/checks run: inspected branch status and five recent commits; scoped `git diff --check` for the documentation files passed. No app code or runtime tests were needed.
- Known issues/decisions: the pre-existing `src/lib/events.functions.ts` compatibility edit and untracked `.agents/`, `CHECKOUT_GAP.md`, and `skills-lock.json` remain untouched. `0007`–`0009` migrations and a coordinated release remain pending. No worktree, deployment, database, or product-feature change was made.
- Exact next recommended task: assign Thread B `EVENT-READ-01`; have it inspect and claim the unfinished local event-read edit, verify the event page, and hand it to Thread C for review before any release.

## 2026-09-30: local signed-in ticket read compatibility

- Last agent: Codex; branch: `codex-dev`; commit: this handoff commit.
- What changed: the signed-in ticket query now reads both the newer multi-event order schema and the older single-event order schema currently hosted in Supabase. Legacy lines inherit their parent event for display. No order, payment, or registration data was modified.
- Files changed: `src/lib/ticket-orders.server.ts`, `.ai/HANDOFF.md`.
- Migrations: none applied. Hosted migrations 0007–0009 remain pending and need a coordinated release.
- Validation: TypeScript, local `/account` and `/account/events` with the existing signed-in session, HTTP 200, and `git diff --check` passed. Both pages show no ticket-load error; no purchased tickets are present for that account.
- Local setup: the existing Supabase secret was loaded into only the current local server process with user approval, and the clipboard was cleared. No key was printed, written to a file, or deployed. Restarting the server requires secure key injection again.
- What needs review: a ticket-bearing legacy account, then a coordinated migration/deployment and real sandbox checkout/webhook test.

## 2026-09-30: GA4 route and conversion tracking

- Last agent: Codex; branch: `codex-dev`; commit: see analytics commit following `8290825`.
- What changed: expanded the existing GA/GTM helper with manual SPA page views, privacy-safe event metadata, CometX conversion events and a paid/confirmed/issued purchase signal. Added payment-status reads only to verify the purchase signal; no payment or checkout mutation changed.
- Files changed: `src/lib/analytics.ts`, public event/membership/cart/login routes, header/home CTA, account/guest ticket return routes, `src/lib/ticket-orders.server.ts`, `tests/analytics.test.mjs`, `.env.example`, `ANALYTICS.md`.
- Migrations: none. No GA ID or production analytics service was configured.
- Validation: focused analytics tests, TypeScript and production build pass. No real GA DebugView or Stripe transaction was available in this cycle.
- Unresolved: add `VITE_GA_MEASUREMENT_ID` in staging and redeploy; disable GA4 Enhanced Measurement history-based page views to prevent duplicates; review analytics consent before production. Browser `purchase_success` requires the buyer to return to the ticket page after payment.
- What needs review: GA4 DebugView event parameters, guest-token privacy, confirmed checkout attribution, and duplicate-pageview configuration before main merge.

## 2026-09-30: remove legacy phantom registrations from account overview

- Last agent: Codex; branch: `codex-dev`.
- What changed: My CometX upcoming events now comes exclusively from confirmed/free ticket orders with issued valid or checked-in tickets. Removed legacy `registrations` from the overview response and its database query; those records remain in Supabase/admin for audit. A previous prototype RPC could mark priced tickets `confirmed` with `price_paid=0`, so status alone was not proof of an owned ticket. Event detail no longer calls such a reservation “My tickets.”
- Files changed: `src/lib/membership.functions.ts`, `src/routes/account.index.tsx`, `src/lib/events.functions.ts`, `src/components/site/EventDetailTemplate.tsx`, `src/lib/ticket-status.ts`, `tests/ticket-status.test.mjs`.
- Migrations: none; no data deleted or modified.
- Validation: TypeScript, focused status tests and production build passed. Local browser no longer shows the legacy rows; its issued-ticket query currently fails because this local workspace lacks a Supabase server key.
- Unresolved issue: configure a server-only Supabase key for local ticket-order reads; do not expose it to the browser or commit it.
- What needs review: signed-in overview showing only issued tickets; historical legacy paid registrations would require verifiable payment linkage before being restored to this view.

## 2026-09-30: separate checkout holds from owned tickets

- Last agent: Codex; branch: `codex-dev`.
- What changed: shared status helpers classify owned legacy registrations and issued order tickets. My events now displays only confirmed/free orders with valid or checked-in issued tickets; payment-return polling still waits for fulfillment and clears purchased browser-cart lines. The My CometX overview lists upcoming confirmed events, active membership, and staff access only. Pending registration is no longer treated as an owned ticket on event detail. Zero-price tickets are labeled “Free,” not automatically a membership inclusion.
- Files changed: `src/lib/ticket-status.ts`, `src/lib/events.functions.ts`, `src/lib/membership.functions.ts`, `src/routes/account.index.tsx`, `src/routes/account.events.tsx`, `tests/ticket-status.test.mjs`.
- Migrations: none. Checkout, Stripe, cart storage, and payment backend unchanged.
- Validation: focused status tests, TypeScript check, and production Vite build passed.
- Unresolved issues: hosted migrations 0007–0009 and their coordinated deployment remain pending from earlier work; no live or sandbox payment was run in this cycle.
- What needs review: signed-in account with a pending payment versus an issued ticket, and a free ticket that was not granted by membership.

## 2026-09-30: one buyer-name shortcut at Attendee 1 per event

- Last agent: Codex; branch: `codex-dev`.
- What changed: the cart shows the buyer-name shortcut only for Attendee 1 of the first ticket type in each event. Removed the repeated disabled “Buyer already assigned to this event” action. Using the shortcut moves the buyer name from another ticket of the same event; duplicate-name checkout protection remains.
- Files changed: `src/routes/cart.tsx`, `tests/ticket-cart.test.mjs`.
- Migrations: none. Checkout, payment, and order logic unchanged.
- Validation: focused cart tests (2/2), TypeScript and production Vite build passed.
- What needs review: visual check of two ticket types in one event and two separate event groups.

## 2026-09-30: event-category membership pricing

- Last agent: Codex; branch: `codex-dev`.
- What changed: event categories now drive Fanoušek, CometXXL and Ambasador quotes. The event ticket selector and cart display public price, applicable benefit and final price; checkout recalculates server-side and stores each order line's public/final price, benefit and active tier. Admin event editing uses explicit categories.
- Files changed: `src/lib/pricing.ts`, `src/lib/events.functions.ts`, `src/components/site/EventDetailTemplate.tsx`, `src/routes/cart.tsx`, `src/components/admin/EventForm.tsx`, `src/lib/admin.functions.ts`, `drizzle/migrations/0009_membership_event_pricing.sql`, `tests/membership-pricing.test.mjs`.
- Migration: `0009_membership_event_pricing.sql` added and verified in isolated PostgreSQL; **not applied to hosted Supabase**. Apply only after 0007 and 0008 and release app/database together. It classifies verified events, seeds only specified tier benefits, removes exact legacy guessed POTLA.CH percentages, and adds immutable quote columns to order lines.
- Validation: focused pricing, cart and ticket-database tests 4/4, TypeScript and production Vite build passed. The unrelated full-suite Node 22 type-strip failure remains.
- Unresolved issues: verified POTLA.CH discount percentage is absent; public price remains until CometX configures it. No hosted migration, payment or Vercel deployment was performed. Sandbox checkout/webhook still needs an end-to-end release check.
- What needs review: migration against hosted seed state, exact POTLA.CH discount configuration, category assignment of any staff-created events, and member quotes in a real signed-in checkout.

## 2026-09-30: one buyer-named attendee per event

- Last agent: Codex; branch: `codex-dev`.
- What changed: cart attendee controls allow the buyer's name on only one ticket per event. Selecting it on another ticket clears the prior buyer-named attendee for that event; tickets for other events remain unchanged. The selected ticket can be cleared, and existing duplicate buyer names block checkout with a customer-facing correction message.
- Files changed: `src/lib/ticket-cart.ts`, `src/routes/cart.tsx`, `tests/ticket-cart.test.mjs`.
- Migrations: none. Stripe/order backend unchanged.
- Validation: TypeScript, focused cart tests (2/2), diff check. Local browser showed the updated controls; no buyer details, cart items or payments were submitted or changed during browser verification.
- Unresolved issues: existing saved cart duplicates must be corrected by the customer; no cart data was silently erased.
- What needs review: guest and signed-in buyer-name edits after attendee selection, keyboard behavior, legacy duplicate-name cart recovery.

## 2026-09-30: buyer name shortcut for each ticket attendee

- Last agent: Codex; branch: `codex-dev`.
- What changed: each attendee in the cart has a “Same name as buyer” action. It copies the buyer's current first and last name to only that attendee, including when the cart contains tickets from several events. Existing attendee names on other tickets are preserved.
- Files changed: `src/routes/cart.tsx`, `src/lib/ticket-cart.ts`, `tests/ticket-cart.test.mjs`.
- Migrations: none. Checkout and Stripe logic unchanged.
- Validation: TypeScript, focused cart tests (2/2), diff check, and local browser rendering of the action for every attendee passed. No checkout or payment submitted.
- Unresolved issues: none specific to this UI change; existing multi-event checkout release prerequisites below remain.
- What needs review: keyboard/accessibility behavior and signed-in profile prefill in the cart.

## 2026-09-30: one order and one Stripe payment across multiple events

- Last agent: Codex
- Branch: `codex-dev`; implementation commit `506194d`. No Supabase migration or Vercel deployment was performed in this cycle.
- What changed: migration `0008_single_multi_event_order.sql` converts a new checkout batch into one order containing event-scoped lines, one payment, normalized named attendees and one issued ticket per attendee. The Stripe test Checkout Session includes every selected line (including zero-price member benefits) and carries the internal order ID. Webhook validation checks session/order/amount/currency, locks event capacity, issues tickets once and sends paid-but-unfulfillable orders to manual review. Event, account, guest and admin views use each line's event; cart cleanup is purchase-specific and idempotent.
- Files changed: `drizzle/migrations/0008_single_multi_event_order.sql`, `src/lib/ticket-orders.server.ts`, `src/lib/ticket-orders.functions.ts`, `src/lib/ticket-payments.server.ts`, `src/lib/events.functions.ts`, `src/lib/ticket-cart.ts`, `src/routes/{account.events,admin.orders,tickets.guest}.tsx`, `tests/{ticket-cart,ticket-database}.test.mjs`, `CMS_SETUP.md`.
- Validation: focused ticket tests 8/8 passed, isolated PostgreSQL migrations and replay/free/member/capacity tests passed, TypeScript and Vite production build passed. The unrelated full-suite Node 22 type-stripping tests (`business.test.mjs`, `event-template.test.mjs`) still fail in the test runner; focused tests pass.
- Migrations: 0008 added but **not applied** to the hosted Supabase project. Verify 0007 is present, then apply 0008 and deploy the matching app together. Current staging site does not yet run this implementation.
- Unresolved issues: run a real Stripe sandbox checkout and signed webhook through two events after coordinated release; simulate concurrent buyers in hosted PostgreSQL; configure/verify Resend before promising guest confirmation email. Mixed currencies remain disallowed in one Stripe Session. The existing all-tickets member-discount rule still needs CometX business approval.
- What needs review: SQL migration/legacy-batch compatibility, RLS/grants, event-capacity locking under concurrent checkouts, zero-price lines in Stripe test Checkout, and admin totals.

## 2026-09-28: multi-event cart, single combined purchase

- Last agent: Codex
- Branch: `codex-dev`; commit `412e652` pushed. Vercel Preview is ready at `https://cometx-prototype-git-codex-dev-lucka2.vercel.app/`; Production was not changed. Preview still has no Supabase public environment variables, so database-backed events/cart data do not load there. Migration `0007_multi_event_checkout.sql` is not applied to Supabase.
- What changed: the cart now keeps and displays multiple event groups with attendee names per ticket. One checkout creates one Stripe test-mode Checkout Session and a separate order per event; fulfillment confirms the batch atomically, issues one ticket per attendee, and preserves private guest access. Event-scoped customer ticket access/account cleanup is batch-aware.
- Files changed: `src/lib/ticket-cart.ts`, `src/routes/cart.tsx`, `src/lib/ticket-orders.functions.ts`, `src/lib/ticket-orders.server.ts`, `src/routes/api/public/stripe-webhook.ts`, `src/routes/tickets.guest.tsx`, `src/routes/account.events.tsx`, `src/routeTree.gen.ts`, `drizzle/migrations/0007_multi_event_checkout.sql`, ticket cart/database tests.
- Migrations: `0007_multi_event_checkout.sql` added and tested in isolated PostgreSQL; not applied to Supabase.
- Validation: TypeScript check, focused ticket cart/database tests, and `git diff --check` passed. No Stripe session, payment, migration, or deployment was performed.
- Unresolved issues: apply migration 0007 to the target Supabase project and deploy this branch before the live/staging cart can use batch checkout. Mixed-currency carts are prevented because one Stripe Checkout Session uses one currency. Guest ticket email requires the existing configured email mode; secure access links are still generated.
- What needs review: SQL RPC/RLS/grants and concurrency in the target Supabase; end-to-end sandbox checkout/webhook across two events; cancellation and partial failure handling; attendee/contact emails and account visibility.

## Template

- Task completed: task ID and specific outcome
- Owner / branch / worktree: thread name and isolated checkout
- Files changed: exact paths
- Commit hash: implementation commit SHA; use a separate handoff commit when recording it
- Tests/checks run: commands and result
- Known issues/decisions: blockers, migrations, release state, or none
- Exact next recommended task: one actionable task ID and owner/role

## Setup note

## 2026-09-28: event-scoped cart

- Last agent: Codex
- Branch: `codex-dev`; local changes, not deployed.
- What changed: adding tickets from another event replaces the active cart; multiple ticket types/quantities from one event remain together. Legacy mixed carts retain only the last appended event. Cart displays one event total.
- Files changed: `src/lib/ticket-cart.ts`, `src/routes/cart.tsx`, `tests/ticket-cart.test.mjs`, `tests/ticket-database.test.mjs`.
- Migrations: none; existing database order validation already rejects tickets belonging to another event. Existing Stripe session creation uses the order's paid line items.
- Validation: TypeScript and diff checks passed; cart regression and isolated database tests passed, including mixed-event rejection without an order being created.
- What needs review: browser checkout flow; no external Stripe session/payment was created during this task.

## 2026-09-28: ticket cart and pre-payment review

- Last agent: Codex
- Branch: `codex-dev`
- Commits: `5366fb0` (cart), `885bcd2` (retain until confirmed)
- What changed: added a persistent browser cart with grouped per-event ticket lines, editable quantities, live displayed totals, guest contact fields, member account-data prefill, and a server-validated handoff to the existing Stripe Checkout flow. Payment card details remain on Stripe Checkout. The cart supports multiple events as separate orders; paid cart lines stay available if checkout is cancelled and clear only after confirmed fulfillment.
- Files changed: `src/lib/ticket-cart.ts`, `src/routes/cart.tsx`, `src/routes/events.$slug.tsx`, `src/components/site/EventDetailTemplate.tsx`, `src/components/site/SiteHeader.tsx`, generated `src/routeTree.gen.ts`.
- Migrations: none.
- Validation: TypeScript check, production build, seven ticket-order/database tests, and local browser flow adding a ticket and increasing quantity (CHF 30 → CHF 60). No checkout session or payment was created.
- Unresolved issues: end-to-end Stripe test checkout was not started. Cart contents are browser-local until checkout; this is intentional for a pre-payment basket.
- What needs review: guest/member form behavior, multiple event groups (separate orders), and server revalidation of prices, entitlement, sale window and capacity before Checkout.

## 2026-09-28: staging release and runtime Supabase key compatibility

- Last agent: Codex
- Branch: `codex-dev`
- What changed: applied migrations 0005/0006 together to CometX Production Supabase after confirming the order schema was absent; confirmed the new order tables exist and anonymous callers cannot execute the order RPC. Added a server-side `SUPABASE_SECRET_KEY` fallback because the Vercel project has the current Supabase secret under that name while the deployed app expected only `SUPABASE_SERVICE_ROLE_KEY`.
- Environment: generated `GUEST_TICKET_TOKEN_SECRET` and saved it as a Vercel Production secret; added `APP_URL=https://cometx-prototype.vercel.app`. Email remains disabled. No secret values are committed or printed.
- Deployment: promoted the latest `f78e796` to the staging Production domain. Page renders and ticket choices load. Purchase test exposed the missing Supabase key alias, so this follow-up must be deployed before checkout can work end to end.
- Migrations: `0005_hidden_ticket_payments.sql` and `0006_ticket_orders_and_guests.sql` applied in one transaction through Supabase SQL Editor. Verified tables `ticket_orders`, `ticket_payment_products`, `ticket_attendees`; anon execute privilege is false.
- Unresolved issues: follow-up key fallback needs build/deploy and runtime verification. Do not retry test purchase until the repair is deployed; prior attempt failed before order creation. Confirm a full test Checkout redirect and webhook fulfillment. Member benefit for multi-ticket baskets remains policy-ambiguous.
- What needs review: `client.server.ts` accepts a Supabase secret API key as a server-only RLS-bypass key; verify deployed server functions receive it and public/browser bundle does not include it.

## 2026-09-28: configurable staging deployment

- APP_URL takes precedence over SITE_URL for checkout and ticket-email origins. No app hostname hardcoded. Stripe remains test-only.
- Explicit TICKET_EMAIL_MODE (disabled by default) separates guest purchase/access from email delivery. Enabled mode requires sender/key; mandatory guest token encryption unchanged. Guest page provides a copy-private-link action.
- Real deployed migration/checkout validation remains pending; no Supabase or deployment changes in this commit. Resend DNS is deferred per user instruction.

## 2026-09-28: event handling follow-up

- Customer: show support order IDs, explain pending/manual-review outcomes, surface guest account-link errors; guest ticket route sets noindex/nofollow and no-referrer metadata.
- Admin: search orders by buyer/email/event/reference, filter status, inspect individual attendee codes/statuses. Clarified latest-500 totals and account-holder versus membership distinction.
- Creator/backend: ticket/workshop lookup failures now stop event-save processing instead of silently ignoring database errors. Database regression additionally validates failed/expired payments, tampered amounts and immediate free issuance.
- Validation: typecheck and 25 focused tests pass. Supabase migrations, deployment and real test checkout still pending.
- Resend login now works; Domains explicitly says No domains yet. DNS manager/access requested. No domain/DNS mutation or API-key creation performed. Member discount scope (own ticket/all tickets) also requested; current all-ticket behavior is not an approved business rule.

## 2026-09-27: webhook secret saved with explicit approval

- Saved the sandbox webhook signing secret in Vercel's existing STRIPE_WEBHOOK_SECRET variable (Production and Preview); verified “Updated just now”. User explicitly approved the transfer. A deployment is required for runtime activation.
- Added buyer/payment heading, account-data explanation and secure Stripe test-payment handoff text to the existing event ticket basket in Czech and English. Card details remain on hosted Stripe Checkout.
- Resend redirects to login; user sign-in requested to check a verified sender. Guest email configuration, guest-token encryption secret, Supabase migrations and Production deployment remain outstanding. No payment completed.

## 2026-09-27: sandbox release preparation

- Codex, `codex-dev`: created and verified sandbox webhook `we_1UJtK90A7SoM9pRtZ91gedYV` for the four Checkout lifecycle events. Destination is the existing Vercel `/api/public/stripe-webhook` route. No live payments.
- Saving the webhook signing secret to Vercel was rejected by automatic approval review; explicit user approval requested and pending. Do not claim the environment was updated. Secret preserved in ignored `.env.stripe-webhook.local`; never print or commit it.
- Fixed partial ticket issuance when a later basket line fails capacity validation. Every line is now checked before any attendee is issued. Public member pricing now preserves a free entitlement ahead of a configured member price, matching server behavior.
- Executed all migrations in isolated PGlite PostgreSQL; regression test covers guest/contact separation, payment replay, mixed-line capacity failure and RPC grants. 25 focused tests and typecheck pass.
- Run database test after `npm install --prefix .test-runtime --no-save --package-lock=false @electric-sql/pglite`, then `node --test tests/ticket-database.test.mjs`. Runtime is ignored; root npm install is incompatible with existing `link:.` dependency graph.
- Supabase migrations remain unapplied; Production is unchanged. Verified Resend sender, guest-token secret, group member-benefit policy, deployment and end-to-end test still outstanding.

## 2026-09-25: hidden Stripe event checkout implementation

- Last agent: Codex
- Branch: `codex-dev`
- Commits: `0111c80` (checkout implementation), `c799aeb` (Preview/configuration findings)
- What changed: added server-side sandbox Checkout, Stripe Product/Price sync from admin event saves, quantity-based orders, atomic Supabase seat holds, membership-aware server pricing, idempotent webhook fulfillment, and generic payment/admin UI. Quantity is 1–10 for one ticket type; explicit member price applies per ticket.
- Files changed: `src/lib/ticket-payments.server.ts`, `src/lib/stripe.server.ts`, `src/lib/events.functions.ts`, `src/lib/admin.functions.ts`, `src/components/admin/EventForm.tsx`, `src/components/site/EventDetailTemplate.tsx`, `src/routes/admin.events.$id.tsx`, `src/routes/admin.payments.tsx`, `src/routes/api/public/stripe-webhook.ts`, `src/integrations/supabase/types.ts`, `drizzle/migrations/0005_hidden_ticket_payments.sql`, `STRIPE_INTEGRATION_PLAN.md`.
- Migrations: 0005 added, not applied. Read-only preflight on `vlcssswzlvamtscyobbv` confirmed expected starting schema. Do not apply until new server code can be released in a coordinated deploy; migration replaces old registration RPCs. Vercel generated a branch Preview after push, but it cannot load because public Supabase variables are not configured for Preview; no Production deployment occurred.
- Unresolved issues: Stripe sandbox Workbench has no webhook destination. Runtime Vercel secret env entries exist but values were not inspected; local `.env` lacks service-role/Stripe settings. No end-to-end checkout was executed. Mixed ticket types in one basket are not supported. Preview has intentionally not been connected to Production Supabase, to avoid admin edits against live records. npm launcher is broken on this host, though direct TypeScript/Vite binaries work.
- What needs review: migration grants/RLS and RPC lock/capacity behavior; payment replay/expiry handling; explicit member price semantics for multi-quantity orders; Stripe test-key enforcement; deployment and migration ordering. Build and typecheck pass; no payment or deploy performed.

## 2026-09-25: make event pages purchase-first

- Last agent: Codex
- Branch: `codex-dev`
- Commit: `954768e` (`Show ticket purchase options after prior purchase`)
- What changed: event ticket CTAs now say “Buy tickets” and scroll to ticket options even if the account already has a ticket. Prior ticket status remains visible as “You already have a ticket,” with a “My tickets” link. Removed reservation wording from the purchase flow; button submits to the server-side Stripe checkout action.
- Files changed: `src/components/site/EventDetailTemplate.tsx`, `src/lib/events.functions.ts`, `src/routes/events.$slug.tsx`.
- Migrations: none in this change. Migration 0005 from `0111c80` is still unapplied; Production still runs the older app.
- Unresolved issues: this updates only `codex-dev`, not the Production URL in the screenshot. Checkout is not live until review, migration 0005, test webhook, and coordinated deployment are complete. Vercel Preview lacks Supabase public config.
- What needs review: CTA scroll behavior for logged-in/purchased users, Czech/English purchase wording, and confirmation that a previously purchased seat does not hide additional paid quantity choices.

## Stripe connection and quantity-pricing groundwork

- Codex on `codex-dev`, after `709954d`: verified Stripe plugin access to CometX sandbox (test mode), accepted planner recommendation for hosted Checkout. No live Stripe changes.
- Added pure `ticket-order.ts` quote calculator and six regression tests for multiple types/quantities, single/all ticket member-benefit policies, invalid inputs and minor-unit totals. Not wired into public UI/server checkout yet; no migrations or deployment.
- Blocking business choice: does membership discount cover only the member's ticket or every ticket in their basket? Awaiting user answer. Second sellable ticket type/price is not confirmed; expired early birds must stay inactive.
- Remaining: runtime sandbox key/webhook setup, atomic multi-seat holds, idempotent order/session creation, verified webhook fulfillment and account/admin order display, full sandbox purchase test. Agent OAuth alone does not configure Vercel payments.

## Event CTA correction

- Codex on `codex-dev`, following `1ec8ca6`: all My registration shortcuts now navigate to `/account/events` rather than the same-page ticket anchor. Unregistered visitors see Choose a ticket; clicking scrolls to and focuses/highlights the actual ticket options, including repeated clicks.
- Preview remains non-bookable; registration/payment logic and database unchanged. Added regression coverage for registered navigation and ticket targets. Typecheck and template tests pass; deployment verification reported in the task.
- Review: keyboard focus, sticky desktop/mobile ticket panel, account navigation. No main merge.

## 2026-09-25: official workshop content sync

- Last agent: Codex; branch: `codex-dev`; follows `ed8620b`.
- Updated three published workshops through `/admin`: original descriptions, existing hero assets, speaker links, speaker roles/bios, start/end times and emotional-regulation address. Live conflict source says 12 March 2027 (cached search says 11 March). See `EVENT_CONTENT_SYNC.md` for sources and scope.
- No application code/schema changes. Supabase content updates apply directly to production and local views. Existing ticket IDs/prices/capacity/entitlements and registrations preserved; expired early birds remain inactive.
- Payment integration unchanged. Review content fidelity and Swiss-local dates; source content is Czech even when the navigation language is English.

## 2026-09-25: site-wide softness and ticket data repair

- Last agent: Codex; branch: `codex-dev`; commit follows `02eedc2`.
- Shared buttons/status labels are pill-shaped; cards, forms, image containers and account/admin surfaces have rounded corners and softer borders. Removed the nested event-ticket scrollbar. No auth or registration business logic changed.
- Applied `supabase/repair-workshop-tickets-20260925.sql` to `vlcssswzlvamtscyobbv`: verified five ticket rows, three active regular tickets (CHF265/315/554) and two inactive expired early birds. Registration deadlines populated only where missing. This supersedes the earlier NOT executed note below.
- Stripe MCP endpoint configured locally but OAuth expired awaiting user sign-in. No planner tools or sandbox API keys available. Official Stripe skill installed locally as requested fallback; `STRIPE_INTEGRATION_PLAN.md` records findings and gated implementation plan. No live payments enabled; reservations remain unpaid.
- Validation: typecheck, 22 tests and build pass. Repaired AI ticket/registration deadline visibly render; mobile event has no horizontal overflow. Additional deployment checks recorded separately in final response.
- Review: shared visual changes, ticket data provenance, payment hold/idempotency/fulfilment plan. Do not merge main before review. Sandbox purchases require connection/configuration plus implementation and end-to-end verification; do not claim they work yet.

## 2026-09-25: softer event detail styling

- Last agent: Codex; branch: `codex-dev`; commit: follows `8b1e8d1`.
- Changed only `EventDetailTemplate.tsx`: rounded images/cards, pill CTAs, fewer dividers, more whitespace, larger lime surfaces and official X artwork. No business logic, database or unrelated page changes.
- Validation: build/typecheck and 22 tests pass; desktop/mobile visual check, 390px without horizontal overflow.
- Review: responsive populated ticket cards and speaker/gallery sections; no live deployment.
- Separate interrupted task: `supabase/repair-workshop-tickets-20260925.sql` is prepared but NOT executed or committed. Admin SQL read confirmed all three workshops have no ticket records. Official active prices verified: emotional regulation CHF265, AI CHF315, conflict CHF554. Early bird AI CHF230 and conflict CHF322 are expired. Do not claim the ticket repair is complete.

The prior local CMS edits were preserved as commit `b293f60` on `codex/wip-pre-parallel-20260925`. They predate newer GitHub `main` commits and have not been merged into `codex-dev`; inspect before reusing.

## 2026-09-25: default event detail template

- Last agent: Codex
- Branch: `codex-dev`
- Commit: see the event-template commit following `5239624`.
- What changed: shared editorial hero, desktop sticky ticket card, mobile booking shortcut, optional description sections, programme/workshops, complete speaker bios, practical information and gallery. Uses existing CometX assets/tokens and Supabase data. Saved admin edits invalidate open previews through BroadcastChannel; preview booking is disabled. The custom symposium archive and unrelated public pages are unchanged.
- Files changed: `EventDetailTemplate.tsx`, `event-content.ts`, event detail route/server response, event admin form, two test files, `EVENT_TEMPLATE.md`.
- Migrations: none. No live database writes or deployment performed.
- Validation: build/typecheck pass; 22 tests pass including real template rendering with test-only fixtures for multiple tickets/member pricing, sold-out and preview states, optional sections and escaped content. Browser checks at 390/768/1440px show no horizontal overflow; mobile ticket anchor works. Two published events load from Supabase with no broken rendered images.
- Unresolved issues: tested published records currently have no hero image, linked speakers or ticket types; optional sections correctly stay absent. Authenticated admin save/preview and a real reservation were not end-to-end tested; no live records were modified. Port 3001 was occupied; this branch runs locally on port 3002. Preview reflects saved changes, not unsaved form edits.
- What needs review: admin preview authorization and refresh, ticket/member states, date/time display, responsive sticky card. Existing registration mutation/security checks are unchanged. Review before merging/deploying.

## 2026-09-25: official brand asset integration

- Last agent: Codex
- Branch: `codex-dev`
- Commits: `e54332e` (official assets and provenance), `a2cd576` (website integration)
- What changed: inspected all 96 ZIP entries, all 7 Illustrator artboards and the brandbook; imported 80 web exports plus the brandbook. Corrected the header/admin wordmark (previous file was X-with-claim), footer lockup, local favicon, shared palette and clear-space rules. Replaced the handmade divider with official X artwork and fixed tablet footer overflow. Existing site structure and business flows retained.
- Files changed: `BRAND_ASSETS.md`, `docs/brand/`, `public/brand/cometx/`, `scripts/import-brand-assets.ps1`, `.gitattributes`, `src/lib/brand-assets.ts`, shared site components, `src/styles.css`, root head links and home divider.
- Migrations: none; no database or authentication code changed.
- Validation: production build and typecheck pass; 14 existing tests pass. All 81 imported files match source SHA-256; all 80 images decode/render and return image responses over HTTP. Browser checks pass for home at 390/768/1440px, login at 390px, events at 1280px and membership at 390px: no horizontal overflow or missing brand images. Satoshi loaded with network-enabled browser checks. Screenshots inspected for desktop/mobile home. This is not an authenticated admin or registration end-to-end test.
- Unresolved issues: original X artwork uses #DCF000 while the brandbook palette says #E1F03C; preserve exports pending designer clarification. Fonts and separate icon/photo exports are absent. Illustrator master remains in the owner's original ZIP, outside Git/public assets. Existing API deprecation/build warnings remain.
- What needs review: official variant mapping, responsive header/footer, logo exclusion zones, favicon contrast, asset manifest and importer. Review against setup commit `af75162`. Do not merge to main before Claude review.

## 2026-09-25: guest and member ticket purchase flow

- Last agent: Codex
- Branch: `codex-dev`
- Commit: `2544977` (ticket purchase flow implementation)
- What changed: event checkout now supports guest or signed-in buyers, mixed ticket types and quantities, public/member entitlement pricing, free tickets, private guest ticket links, post-payment attendee issuance, account ticket list/claim, and admin order/attendee/revenue reporting.
- Files changed: `drizzle/migrations/0006_ticket_orders_and_guests.sql`, `src/lib/ticket-orders.server.ts`, `src/lib/ticket-orders.functions.ts`, `src/lib/events.functions.ts`, `src/lib/admin.functions.ts`, event detail UI/route, account events, registration redirect, guest ticket route, admin orders view/sidebar, Stripe webhook, Supabase RPC types, `CMS_SETUP.md`, `STRIPE_INTEGRATION_PLAN.md`, `.ai/CONTEXT.md`.
- Migrations: 0006 added; not applied. Apply 0005 then 0006 only in coordinated deployment after review. No Stripe transaction or Production deployment performed.
- Validation: TypeScript, production build, focused ESLint, 24 focused tests and `git diff --check` pass. Existing TanStack deprecation/bundle warnings remain. SQL was reviewed statically but not parsed/executed; no database CLI/connection was used. No end-to-end order/payment/webhook was run.
- Unresolved issues: guest confirmation email requires `RESEND_API_KEY`, verified `RESEND_FROM_EMAIL` and stable `GUEST_TICKET_TOKEN_SECRET`; Vercel values were not inspected or changed. Guest checkout fails closed until Resend is configured. Stripe test webhook is not configured. No end-to-end order was created. Refund initiation is not enabled. The design applies a member's configured member/free benefit to every ticket in the basket; CometX should confirm this policy.
- What needs review: SQL syntax and SECURITY DEFINER grants; atomic capacity across legacy registrations and order holds; entitlement calculation and mixed/free lines; webhook replay, late-payment/manual-review and cancellation behavior; guest token cryptography/email retry/contact consent; account claim email matching; admin PII boundary and revenue calculation; responsive guest form/quantity UX.
