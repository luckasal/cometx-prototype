# Membership pricing acceptance — 16 October 2026

Status: local rule verification passed; hosted purchase acceptance **not complete**. No charges, refunds, membership edits or customer-data writes were made for this audit.

## Hosted acceptance availability check

On 16 October, read-only aggregate queries found **0 active Fanoušek, 4 active CometXXL and 0 active Ambasador memberships**. Upcoming open sales currently include regular-event and workshop ticket types, but no Symposium or POTLA.CH ticket types. Therefore the full tier/category matrix cannot be run against existing hosted accounts/events. Existing CometXXL members must not be used to spend a one-time benefit without their informed agreement.

## Hosted benefit assignments (read-only)

| Tier | Relevant event benefits currently assigned |
| --- | --- |
| Fanoušek | 50% SCAS Symposium |
| CometXXL | One free SCAS Symposium ticket; 50% other regular events; CHF 100 one-time workshop credit |
| Ambasador | One free SCAS Symposium ticket; one free POTLA.CH ticket; CHF 300 one-time workshop credit |

All three also have member content and community membership. No tier currently has a `potlach_discount` assignment. These are hosted database assignments, **not** a claim that every public ticket is currently on sale or that a payment succeeded.

## Isolated quote and order examples

The following CHF figures use test fixtures (CHF 265 Symposium/workshop, CHF 30 regular/POTLA.CH), not current event prices:

| Buyer and ticket | Fixture total | Rule verified |
| --- | ---: | --- |
| Guest, Symposium | 265.00 | Public price |
| Fanoušek, Symposium | 132.50 | 50% off |
| CometXXL / Ambasador, Symposium | 0.00 | One included ticket |
| CometXXL, regular event | 15.00 | 50% off one ticket |
| CometXXL, two regular tickets | 45.00 | One at CHF 15, second at CHF 30 |
| CometXXL, workshop credit selected | 165.00 | CHF 100 off one workshop ticket |
| Ambasador, POTLA.CH | 0.00 | One included ticket |
| Ambasador, CHF 265 workshop credit selected | 0.00 | CHF 300 credit capped at ticket price |
| Fanoušek, workshop | 265.00 | No workshop credit |

The pricing SQL and TypeScript quote agree on these fixtures. A prior pending order reserves the single event benefit, so a repeat order uses public pricing. The workshop credit is opt-in, is reserved by a pending checkout, becomes available after expiry, and remains unavailable after a confirmed purchase. Stripe Checkout Session input-shape tests pass, but they do not prove actual Stripe delivery.

Focused command: `node --experimental-strip-types --test tests/membership-pricing.test.mjs tests/workshop-credit.test.mjs tests/ticket-order.test.mjs tests/ticket-cart.test.mjs tests/stripe-webhook-event.test.mjs tests/membership-benefit-rules.test.mjs` — 17/17 pass. The separate older `ticket-database.test.mjs` stops while applying migration `0016` to its incomplete PGlite fixture (`select_prototype_membership` absent), before ticket assertions. It is not a hosted checkout result.

## Required to close this task

Use designated Fanoušek, CometXXL and Ambasador sandbox accounts and suitable test tickets in each missing event category, with a controlled test-card purchase and agreed refund/cleanup. For each tier, observe the live event quote, cart total, Stripe Checkout amount, webhook delivery, confirmed order/ticket, My CometX credit state and post-refund behavior. Include guest, two-ticket and repeated-event cases. Record actual event/ticket IDs and CHF totals without publishing personal data. Do not mark this task done until these hosted observations match the rule matrix.
