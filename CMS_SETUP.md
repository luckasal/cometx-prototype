# CometX CMS setup

Apply `drizzle/migrations/0003_cometx_cms_contacts_and_payments.sql` and then `drizzle/migrations/0004_event_publishing_workflow.sql` in the Supabase SQL editor after the existing migrations. They add the staff CMS tables, RLS policies, newsletter subscription RPC, event type/gallery fields, payment records, and the separate event publishing workflow.

Run `supabase/real-content-2026.sql` once after the core migrations to seed the three verified event images and retire the older demo event records without deleting registrations.

## Environment settings

Set these in Vercel for the production and preview environments:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` when newsletter delivery is ready
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` when payments are enabled
- `VITE_GA_MEASUREMENT_ID` and/or `VITE_GTM_CONTAINER_ID` after analytics tags are added

The current checkout remains prototype-only. Do not configure live Stripe prices or webhooks until CometX has decided its payment and invoice flow. The CMS stores the corresponding Stripe and receipt fields so the integration can be enabled without changing the content model.

## Staff workflow

- Use **Events** for event details, registration windows, speaker assignment and ticket capacity/pricing. Save a draft, preview it privately, publish it, or unpublish it without losing event data or registrations.
- Use **Contacts** for newsletter/event leads. A contact can link to an authenticated member but does not create an account or membership.
- Use **Content** for videos, galleries, opinions, open positions and symposium entries; articles retain their existing editorial workflow.
- Use **Settings** to verify whether the optional integration environment variables are present. Secrets never appear in the admin UI.
