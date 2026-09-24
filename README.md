# CometX

This is the active CometX application imported from the supplied Lovable archive. It uses TanStack Start, React, strict TypeScript, Tailwind, Supabase and Stripe test mode. It preserves the imported dark/lime CometX design and images. See DEVELOPMENT.md for verified behavior and remaining work.

## Local development

Use Node.js 22.14+ and pnpm 11. From this directory:

```sh
pnpm --ignore-workspace install
pnpm --ignore-workspace dev --port 3001 --host 127.0.0.1
```

Open http://127.0.0.1:3001. The older app on port 3000 is a separate scaffold.

The supplied .env already has the Supabase public project configuration. Keep it private. .env.example documents the additional server settings. Never use VITE_ prefixes for service-role, Stripe secret or webhook keys. Both SUPABASE_URL and VITE_SUPABASE_URL must point to the same project, and both public-key variables must use that project's publishable key.

```sh
pnpm --ignore-workspace run typecheck
pnpm --ignore-workspace test
pnpm --ignore-workspace build
```

The build emits .output/server and .output/public. The tests use Node's built-in test runner with TypeScript stripping; no test database is changed.

## Architecture

Routes live in src/routes. Server functions are in src/lib/*.functions.ts; secret-bearing code lives in *.server.ts and is imported inside handlers. Public reads use RLS. Signed-in reads carry the caller's JWT. Admin mutations separately require an authenticated admin, using public.user_roles as the authoritative role store. Service-role credentials never belong in browser configuration.

Membership benefits are data-driven through membership_plans, entitlements and plan_entitlements. Pricing is calculated on the server. The database reservation function repeats the entitlement check and serializes seat allocation. SQL capacity enforcement also protects privileged inserts.

## Database and migrations

All SQL is in drizzle/migrations. The archive already contains schema and seed migrations 0000 and 0001. A fresh Supabase project needs those in order, then 0002_registration_integrity.sql. Apply the committed files using your authenticated SQL migration workflow or the Supabase SQL editor. Do not generate a replacement schema from drizzle/schema.ts: that imported file is only a placeholder.

The configured remote project already has data. Apply only unapplied migrations after checking its migration history. Migration 0002 has not been remotely applied in this development session. It creates reserve_free_ticket, registration capacity enforcement, a private Stripe receipt table and fulfill_cometx_checkout. The payment function is executable only by service_role; free reservations require authenticated callers and derive the user ID from auth.uid().

Do not rerun the original seed migration against existing data: it is not repeatable. Use a separate development project for seed resets. A repeatable standalone seed workflow is still outstanding.

## Demo accounts

Create test users through Supabase Auth in a development project, with passwords supplied locally. The Auth trigger creates profiles and default roles. For an administrator, insert its user UUID into public.user_roles with role='admin' using an authorized database administrator. Never derive admin roles from user-editable metadata.

For membership demos, create active memberships pointing to the relevant plan IDs, with starts_at in the past and ends_at in the future. Suggested accounts: admin, regular user, Fanoušek, CometXXL and Ambasador. No passwords or private account data are committed. No demo accounts were created in this session.

## Stripe test workflow

Set server-only STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, plus SITE_URL=http://127.0.0.1:3001. The app rejects live keys. Forward test events with:

```sh
stripe listen --forward-to http://127.0.0.1:3001/api/public/stripe-webhook
```

Use the returned signing secret in local configuration and restart the server. Checkout creates a one-time annual membership payment or ticket payment. The signed webhook, not the redirect, grants access. Only paid test sessions qualify. Database fulfillment and the session receipt commit in one transaction, so retries do not duplicate tickets or extend membership twice. Failed database writes return 500 so Stripe retries.

Paid checkout seat holds and automatic refunds are not implemented yet. Keep this in test mode until that path is completed and tested.

## Main routes

Public: /, /events, /events/$slug, /membership, /community, /community/articles/$slug, /partners, /about.

Account: /login, /register, /account, /account/events, /account/membership, /account/profile.

Admin: /admin plus events, speakers, articles, plans, members, registrations, partners and workshops. Partners/workshops are currently lists; image fields currently accept URLs.

Deployment details are in DEPLOYMENT.md. Production limitations and future scope are in PRODUCTION_PLAN.md.
