# Agent handoff

Update this at the end of each implementation cycle. Keep entries short and factual.

## Template

- Last agent: Codex or Claude
- Branch: `codex-dev` or `claude-review`
- Commit: full or short Git SHA
- What changed: concise outcome
- Files changed: key paths
- Migrations: added/applied/not applied, with filenames
- Unresolved issues: blockers and known limitations
- What needs review: exact flows, schema, permissions, or edge cases

## Setup note

## 2026-09-25: hidden Stripe event checkout implementation

- Last agent: Codex
- Branch: `codex-dev`
- Commit: pending
- What changed: added server-side sandbox Checkout, Stripe Product/Price sync from admin event saves, quantity-based orders, atomic Supabase seat holds, membership-aware server pricing, idempotent webhook fulfillment, and generic payment/admin UI. Quantity is 1–10 for one ticket type; explicit member price applies per ticket.
- Files changed: `src/lib/ticket-payments.server.ts`, `src/lib/stripe.server.ts`, `src/lib/events.functions.ts`, `src/lib/admin.functions.ts`, `src/components/admin/EventForm.tsx`, `src/components/site/EventDetailTemplate.tsx`, `src/routes/admin.events.$id.tsx`, `src/routes/admin.payments.tsx`, `src/routes/api/public/stripe-webhook.ts`, `src/integrations/supabase/types.ts`, `drizzle/migrations/0005_hidden_ticket_payments.sql`, `STRIPE_INTEGRATION_PLAN.md`.
- Migrations: 0005 added, not applied. Read-only preflight on `vlcssswzlvamtscyobbv` confirmed expected starting schema. Do not apply until new server code can be released in a coordinated deploy; migration replaces old registration RPCs.
- Unresolved issues: Stripe sandbox Workbench has no webhook destination. Runtime Vercel env entries exist but values were not inspected; local `.env` lacks service-role/Stripe settings. No end-to-end checkout was executed. Mixed ticket types in one basket are not supported. npm launcher is broken on this host, though direct TypeScript/Vite binaries work.
- What needs review: migration grants/RLS and RPC lock/capacity behavior; payment replay/expiry handling; explicit member price semantics for multi-quantity orders; Stripe test-key enforcement; deployment and migration ordering. Build and typecheck pass; no payment or deploy performed.

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
