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
