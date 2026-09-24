# Production plan

The prototype has database-backed public pages, Supabase authentication screens, account and admin flows, data-driven membership pricing, and Stripe test checkout code. This development pass adds authorization fixes, business tests and a transaction-based registration/payment migration. See DEVELOPMENT.md for what has actually been verified.

It is not yet production-ready. Production builds and pure logic tests pass, but authenticated end-to-end, database concurrency and RLS tests remain. The new migration must be applied before testing reservations and fulfillment. Paid checkout holds/expiry, refund reconciliation, image storage uploads, password reset and atomic multi-table admin saves remain outstanding. Email confirmation uses Supabase; a Resend transactional email implementation is still future work.

Recommended deployment components are Supabase, Cloudflare, Stripe and optionally Resend for email. Planning allowances from the project brief are about USD 25/month for Supabase Pro, USD 0–5/month for low Cloudflare usage, a free Resend tier at low volume, and transaction-based Stripe fees. These are budgeting assumptions, not verified current quotes. Check provider pricing before purchase; usage, backups and email volume can increase costs.

Next milestones:

- Configure staging keys, apply migration 0002, provision demo users, and verify the full member reservation/admin publication scenario.
- Add temporary paid-ticket holds, expiry, payment reconciliation and refunds, then test concurrent purchases and webhook replay.
- Complete Storage uploads, recovery emails, input validation, audit trails, accessibility and operational monitoring.
- Replace all placeholder copy and records with approved CometX content; validate privacy/terms and retention requirements.
- Add QR check-in, company accounts, partner portal, member directory, job board, advanced content editing, email automation and analytics after the core flows are reliable.
