# CometX context

- The existing prototype is a React app using TanStack Start, Vite, and file based routes in `src/routes/`.
- Supabase provides PostgreSQL, Auth, profiles, membership plans and memberships, events, tickets, registrations, and admin permissions. Treat its data and RLS policies as authoritative.
- Vercel hosts the web prototype. Local and deployment environment variables are documented in `CMS_SETUP.md`; keep secrets out of Git and browser bundles.
- `/admin` is the CometX staff CMS for events, members, contacts, registrations, memberships, newsletter, payments, content, partners, and settings. `/account` is the member area.
- Contacts and newsletter subscribers are separate from authenticated members. Payment and invoice fields are prepared for Stripe; live charging is not enabled by this setup.
- Event pages and pricing should read Supabase records. Keep registration capacity and permission checks on the server/database side.
- Official CometX logos and brand elements live in `public/brand/cometx/`; use the current UI and brandbook rather than redesigning pages.
- SQL migrations live in `drizzle/migrations/`. Check migration order and `CMS_SETUP.md` before database changes.
- The original checkout had unfinished local edits based on an older `main`. They were preserved in local branch `codex/wip-pre-parallel-20260925` at commit `b293f60`; compare with current code before reusing them.
