# Membership benefits: current offer and operating rules

Checked against the hosted Supabase plan assignments on 17 October 2026. This records the existing offer; it does not change a plan, price, entitlement or Stripe product.

| Plan | Ticket and access benefits |
| --- | --- |
| Fanoušek | Member content; community membership; 50% off one SCAS Symposium ticket. |
| CometXXL | Member content; community membership; one SCAS Symposium ticket included; 50% off one non-workshop event ticket per event; one-time CHF 100 workshop credit. |
| Ambasador | Member content; community membership; one SCAS Symposium ticket included; one POTLA.CH ticket per event included; one-time CHF 300 workshop credit. |

`potlach_discount` exists in the catalogue but has **zero assigned active plans**. It is not advertised as an active benefit. Keep its key for historical compatibility; do not assign or delete it merely to tidy the list.

## Editing and lifecycle

- Back Office → Memberships edits definitions and plan assignments. An unassigned benefit is not offered to members. The ticket editor reads those assignments to show eligibility and estimated one-ticket prices. Checkout recalculates the actual price server-side.
- Access benefits gate member-only tickets or content; they do not change prices. A free-ticket benefit, percentage discount and workshop credit are different types. Workshop credit is opt-in in the cart and can only be used once under the current checkout rules. Do not enter an internal numeric `1` for access/free benefits in the editor.
- To introduce a partner benefit, first create it **unassigned** as access-only. Agree the eligibility, redemption instructions, duration and fulfilment owner with the partner; then assign it to the approved plans. Existing custom benefits do not automatically generate a coupon, discount or Stripe product.
- To end a partner benefit, first review any member commitments, communicate the end date, and remove its assignments only after those obligations are met. Automatic expiry, use tracking and partner-coupon redemption are **not implemented**; those need a separate scoped task before promising them publicly.
- Existing paid orders retain their recorded prices when assignments or wording change. Changes to the promised benefit matrix should be reviewed by CometX before saving or publishing.
