# Cloudflare deployment

The current production build generates a Cloudflare Worker config in .output/server/wrangler.json, using nodejs_compat and static assets in .output/public. A build has passed locally; the worker has not been deployed or tested on Cloudflare.

1. Create separate Supabase development and production projects. Apply committed migrations in order, checking existing migration history first. Do not load placeholder seeds into production without reviewing them.
2. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY at build time. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and SITE_URL in the server environment. Secret values must use Cloudflare secrets, not public variables. RESEND_API_KEY is reserved for future email delivery integration.
3. Build from this directory with pnpm --ignore-workspace build. Review the generated Worker name and deploy the generated config with the Cloudflare deployment tooling for your account. Do not publish the parent Next.js scaffold or serve only static assets; the app requires server functions.
4. Configure the Worker custom domain and HTTPS. Use its canonical origin as SITE_URL. Add that origin and its account callback URL to Supabase Auth's allowed redirect URLs. Configure email confirmation and an appropriate SMTP provider.
5. Create a Stripe TEST webhook destination at https://YOUR_DOMAIN/api/public/stripe-webhook for checkout.session.completed and checkout.session.async_payment_succeeded. Store its signing secret server-side. Validate delivery, signature rejection, retries and membership activation on a staging project.
6. Verify anonymous access restrictions, regular versus admin roles, gated content, duplicate reservations, simultaneous last-seat bookings, session changes and mobile navigation before a stakeholder demo.

## Before production

Complete seat holds and refund/reconciliation handling, image upload/storage policies, password recovery, database/RLS integration tests and recovery/backup procedures. Replace seeded people, partners, dates and prices with approved content. Do not enable live payments until those paths are tested. Protect the migration credentials and service key; never expose them in assets, logs or source control.

Media upload is not yet implemented. Current image URL fields and bundled public assets work; do not advertise an upload workflow until the Storage bucket, admin-only write policies and upload UI are added.
