# Vercel demo QA audit

Date: 2026-10-02  
Target: `https://cometx-prototype.vercel.app` (working demo; not `cometx.ch`)  
Deployment: Production alias on `codex/integration-release-20261002`  
Method: read-only browser smoke checks; no form submissions, ticket/cart edits, admin writes, or payments.

## Confirmed problems

| Area | Observed result | Impact |
| --- | --- | --- |
| `/events` | “Loading events…” remained after 5 seconds. | Public event catalogue is unusable. |
| `/events/emocni-regulace-v-kazdodenni-praxi?preview=false` | “Loading event…” remained after 4 seconds. The user’s attached screenshot also shows the server-side data-access error state on this route. | Event detail content and ticket options do not appear. |
| `/community` | “Loading stories…” remained after 4 seconds. | Supabase-fed story cards never appear. External video/gallery/opinion links do render. |
| `/partners` | “Loading partners…” remained after 4 seconds. | Partner records/logos do not appear. Contact links render. |
| `/` | “Loading the community…” remained after 4 seconds. | Homepage community module never completes. Hero and navigation render. |
| `/cart` | “Loading tickets…” persists, subtotal/total are dashes, and “Continue to payment” is disabled. Header displayed a 2-ticket count in the inspected session. | Cart data and checkout cannot be reviewed or continued in this session. |
| `/account`, `/account/events` | Account shell and staff card render, but upcoming events / My tickets remain “Loading…” after 3 seconds. | Members cannot verify owned tickets in the account area. |
| `/admin/payments` | “Loading payments…” remained after 4 seconds. | Staff cannot review payment records here. |
| `/admin/events` | Event rows and edit/view links load, but sales summary is unavailable and sold/revenue columns show `—`. | Event management is available; sales reporting is not. |

## Working or partially working in this pass

- `/membership` loaded all three plan cards and prices after the initial loading state; each plan says online checkout will be available soon, so membership purchase was not available in the page inspected.
- `/about`, `/get-involved`, `/login`, and `/register` rendered their page content/forms. No authentication or signup submission was attempted.
- `/admin` dashboard loaded counts. `/admin/members` and `/admin/registrations` loaded records after waiting; `/admin/orders`, `/admin/plans`, `/admin/contacts`, `/admin/content`, `/admin/partners`, and `/admin/settings` rendered their routes. This was a visual smoke check, not verification of every filter/export/edit action.
- `/admin/analytics` rendered an “Analytics dashboard preview” state, not verified live GA4 reporting.

## Not tested

No payment/Stripe checkout or webhook, ticket purchase, email delivery, newsletter subscription, account creation/login, admin save/delete/publish, export, or database mutation was attempted. Those need a controlled test account and explicit sandbox transaction plan.

## Recommended next task

Trace the canonical deployment’s event-list server function and browser state handling together. Reproduce and log the actual function result on `/events`, `/events/:slug`, `/community`, `/partners`, `/cart`, `/account/events`, and `/admin/payments`; fix the shared cause and add a bounded error/retry state so a failed request cannot spin forever. Then re-run the same route smoke check before testing ticket checkout in Stripe test mode.
