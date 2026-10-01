# CometX context

- This is the real application being prepared for production, currently on a staging domain. No disposable demo shortcuts. Stripe remains test-only. APP_URL (or SITE_URL fallback) controls checkout/email origins; no dependency on moving cometx.ch now. TICKET_EMAIL_MODE defaults to disabled while domain verification is pending; secure guest access remains mandatory.

- The existing prototype is a React app using TanStack Start, Vite, and file based routes in `src/routes/`.
- Supabase provides PostgreSQL, Auth, profiles, memberships/entitlements, events, registrations, contacts, orders, payments, tickets and admin permissions. Treat its data and server-side entitlement/capacity checks as authoritative.
- Vercel hosts the web prototype. Local and deployment environment variables are documented in `CMS_SETUP.md`; keep secrets out of Git and browser bundles.
- `/admin` is the CometX staff CMS for events, members, contacts, registrations, memberships, newsletter, payments, content, partners, and settings. `/account` is the member area.
- Contacts and newsletter subscribers are separate from authenticated members. Payment and invoice fields are prepared for Stripe; live charging is not enabled by this setup.
- Event pages and pricing should read Supabase records. Guest checkout creates contacts but never members/newsletter subscribers; authenticated member pricing, capacity and ticket issuance are validated server-side. Orders/items/attendees are distinct from profiles and memberships.
- Official CometX logos and brand elements live in `public/brand/cometx/`; use the current UI and brandbook rather than redesigning pages.
- Read `BRAND_ASSETS.md` for the full official identity package inventory and source discrepancies. Reuse `src/lib/brand-assets.ts`, `CometXLogo`, `BrandXElement`, and named CSS palette tokens. The main logo is the CometX wordmark, not the separate X-with-claim composition.
- SQL migrations live in `drizzle/migrations/`. Check migration order and `CMS_SETUP.md` before database changes.
- The original checkout had unfinished local edits based on an older `main`. They were preserved in local branch `codex/wip-pre-parallel-20260925` at commit `b293f60`; compare with current code before reusing them.

## Concurrent work and current release boundary

- Threads share this repository as the handoff record, not a single mutable checkout. Give each active thread its own worktree/branch and list ownership in `TASKS.md`; use `HANDOFF.md` for completed work and `REVIEW.md` for findings.
- `codex-dev` currently contains work beyond the hosted Supabase schema. Migrations `0005`/`0006` were applied to the connected Supabase project; `0007`–`0009` are recorded as pending. Do not deploy the whole branch or run migrations casually; verify the target environment and coordinate code, schema, and Stripe test-mode checks.
- At collaboration-setup time, the `cometx-codex` worktree has an unfinished local event-read compatibility change in `src/lib/events.functions.ts` plus unrelated untracked files. The setup task does not claim, alter, or commit them; its owner must inspect and finish that work separately.
