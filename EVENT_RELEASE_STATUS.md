# Event purchase release status

Current implementation lives on codex-dev. Production has not received the new order schema or app release.

| Perspective | Implemented | Outstanding validation/setup |
| --- | --- | --- |
| Customer | Guest name/email, ticket quantities, public/member quote, hosted test Checkout, guest ticket link, account tickets, buy more | Full deployed purchase and email delivery |
| Event creator | Existing draft/preview/publish editor, ticket prices/capacity/sale windows, server Stripe sync | Authenticated save/publish/unpublish and sync verification after migration |
| Admin | Orders/revenue, buyer search, status filters, attendee codes | Check-in and refund actions are not implemented; reporting limited to 500 orders |
| Backend | Service-only order RPCs, atomic capacity, server pricing, signed webhook, replay protection | Apply 0005/0006, guest token secret, verified sender, deploy and verify runtime sandbox key |

Validated in isolated PostgreSQL: all migrations, guest/contact separation, service-only grants, successful fulfillment, replay, mixed-line capacity rejection, failed/expired payments, tampered totals, free issuance. This does not replace live Supabase concurrency or Stripe end-to-end testing.

Stripe sandbox webhook exists and its signing secret was saved in Vercel with user approval. A deployment is required to activate that environment value.

Resend account is accessible but has no verified domain. Domain verification requires DNS access. Do not use the onboarding sender for arbitrary customer emails or claim delivery works.

Business decision pending: membership benefit applies to the member's own ticket or all tickets in their basket. Do not release the existing all-ticket assumption as confirmed policy.
