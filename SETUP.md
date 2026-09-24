# CometX stakeholder prototype

Active app: `imported-cometx` (TanStack Start). Keep the existing frontend.

## Supabase

Your project is `vlcssswzlvamtscyobbv`, in the CometX organisation, Europe (Ireland).
The old Lovable project is no longer used by the active app.

Enable email/password signup in Authentication → Sign In / Providers.
For this isolated demo, **Confirm email is off**. No email provider is needed.
Before public launch, enable confirmation and replace self-selected demo memberships
with an approved membership-management process.

## Local environment

Create `.env` (gitignored) with:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SITE_URL=http://127.0.0.1:3001
```

Use the same URL/key for browser and server. A service-role key, Stripe and email
credentials are **not required** for these prototype flows. Admin actions use the
signed-in user's JWT and database RLS; never put secret keys in VITE variables.

## Database setup

The current project already has the schema, functions and sample events applied.
Do not rerun the base schema there. On a **new empty project**, use SQL Editor:

1. Run `drizzle/migrations/0000_cometx_core_schema.sql` once.
2. Run `supabase/prototype-flows.sql`.
3. Run `supabase/prototype-seed.sql` (repeatable sample plans/events).

Do not apply legacy `0001`/`0002` for this payment-free prototype. The existing UI
expects supporting speakers/partners/articles tables; these are retained for
compatibility, not an expansion of the CMS scope. The initial dashboard schema
used equivalent table definitions with consolidated policy names and admin grants.
SQL Editor execution does not populate the Supabase CLI migration ledger.

Reservations calculate membership pricing inside a database transaction, serialize
capacity checks, prevent duplicate active bookings and save `quoted_price`.
`price_paid` stays zero: no payment is collected. Membership selection is explicitly
a prototype action but persists in PostgreSQL.

## Create your admin

Register normally in the local app. Then run this in your project's SQL Editor,
replacing the email with the account you just created:

```sql
insert into public.user_roles(user_id, role)
select id, 'admin'::public.app_role from auth.users
where lower(email) = lower('YOUR_EMAIL')
on conflict(user_id, role) do nothing;
```

Reload `/account`, then visit `/admin`. Never make all users admins or assign admin
permissions from client-controlled signup metadata. Create a second regular account
to demonstrate member pricing separately from organiser permissions.

## Run locally

```powershell
cd C:\Users\user\Documents\ChatGPT\CometX\imported-cometx
pnpm --ignore-workspace install
pnpm --ignore-workspace dev --port 3001 --host 127.0.0.1
```

Open http://127.0.0.1:3001. Restart after environment changes if Vite fails to reload.
Checks: `node node_modules/typescript/bin/tsc --noEmit` and `pnpm test`.

## Demonstrate the real flows

Register → select a plan on `/membership` → open an event → reserve → refresh
`/account/events` to show persistence. A CometXXL member gets the sample symposium
included; POTLA.CH is half-price (quoted only). `/admin/registrations` lists bookings;
`/admin/events` allows create/edit/publish. The separate `/demo` route is the older
in-memory simulation, not evidence of database functionality.

All seeded event dates/prices are illustrative. No real users or registrations
were copied from the old project. Automated verification created a clearly named
Prototype Test user and sample booking in this project.
