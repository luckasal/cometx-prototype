# CometX app analytics (GA4)

The new CometX app uses the existing GA4 Measurement ID through `VITE_GA_MEASUREMENT_ID`. This sends app activity to the configured GA4 web stream; it does not alter Wix settings or the GA4 property. No Google Cloud service account or Data API credentials are needed for collection. The Measurement ID is public and must not be confused with a secret.

Analytics runs only after the visitor grants consent in the app's analytics prompt. Declined or undecided visitors do not load GA4 or send events. `/admin` routes are excluded. The shared implementation and safe-parameter allowlist are in `src/lib/analytics.ts`; private names, email addresses, attendee data, order IDs, and query strings are never sent.

## Events and firing points

| Event | Where / when it fires | Properties |
| --- | --- | --- |
| `page_view` | `src/routes/__root.tsx`; initial public route and each distinct SPA pathname | Sanitized `page_location`, `page_title`, sanitized `page_referrer` |
| `event_view` | `src/routes/events.$slug.tsx`; published event details load (not preview) | `event_id`, `event_slug`, `event_type` |
| `events_list_view` | `src/routes/events.index.tsx`; published events list is loaded | `event_count` |
| `ticket_select` | `src/components/site/EventDetailTemplate.tsx`; ticket quantity changes from zero to positive | `event_id`, `event_slug`, `event_type`, `ticket_type`, `ticket_type_id`, `quantity`, `value`, `currency`, `pricing_type`, optional `membership_tier` |
| `member_price_view` | `src/components/site/EventDetailTemplate.tsx`; each available member price is shown to an authenticated member, once per event/ticket on that page | event and ticket fields, `value`, `currency`, `pricing_type=member`, optional `membership_tier` |
| `login_for_member_price` | `src/components/site/EventDetailTemplate.tsx`; guest chooses the member-price login action | event and ticket fields, displayed member `value`, `currency`, `pricing_type=member` |
| `add_to_cart` | `src/routes/events.$slug.tsx`; ticket is added from event details | `event_id`, `event_slug`, `event_type`, `ticket_type`, `ticket_type_id`, added `quantity`, `value`, `currency`, `pricing_type`, optional `membership_tier` |
| `remove_from_cart` | `src/routes/cart.tsx`; a cart line quantity is reduced to zero | event/ticket fields when unique, removed `quantity`, `value`, `currency`, `pricing_type`, updated `cart_value` |
| `cart_quantity_change` | `src/routes/cart.tsx`; a nonzero cart line quantity changes | event/ticket fields when unique, resulting `quantity`, `value`, `currency`, `pricing_type`, updated `cart_value` |
| `cart_view` | `src/routes/cart.tsx`; cart and its event details finish loading | aggregate `quantity`, `event_count`, `cart_value`, `currency`; event/ticket/pricing metadata when the cart has one line |
| `begin_checkout` | `src/routes/cart.tsx`; server successfully creates a paid-ticket checkout session | aggregate `quantity`, `event_count`, `value`, `currency`, `cart_value`; event/ticket/pricing metadata when the cart has one line |
| `attendee_details_complete` | `src/routes/cart.tsx`; validated attendee form is submitted to start checkout | cart aggregate fields; no attendee values |
| `checkout_error` | `src/routes/cart.tsx`; checkout-session creation fails | cart aggregate fields and constant `error_type=checkout_start_failed`; raw errors are excluded |
| `payment_cancelled` | `src/routes/cart.tsx`; Stripe returns the browser to the cart cancellation URL and cart data loads | cart aggregate fields; event/ticket metadata when unique |
| `payment_failed` | `src/routes/account.events.tsx` or `src/routes/tickets.guest.tsx`; loaded server order contains a webhook-recorded failed payment | cart/order aggregate fields and unique event/ticket fields when available; deduplicated by internal checkout key, which is not sent |
| `purchase` | `src/routes/account.events.tsx` or `src/routes/tickets.guest.tsx`; server-returned order is paid, confirmed, and all tickets are issued | `quantity`, `event_count`, `value`, `currency`; unique event/ticket fields when available |
| `free_ticket_issued` | `src/routes/cart.tsx`; free-ticket issuance succeeds | `event_count` |
| `membership_view` | `src/routes/membership.tsx`; membership page opens | None |
| `membership_cta_click` | `src/components/site/SiteHeader.tsx`, `src/routes/index.tsx`, and `src/routes/membership.tsx`; membership CTA is clicked | `placement` or `plan`, optional `membership_tier`, `value`, `currency`, `destination` |
| `membership_activated` | `src/routes/account.membership.tsx`; return route sees server-confirmed active membership | `membership_tier` |
| `newsletter_signup` | `src/components/site/SiteFooter.tsx`; subscription succeeds | `placement` |
| `login` | `src/routes/login.tsx`; password login succeeds | `method` |
| `signup` | `src/routes/register.tsx`; new account signup succeeds | `method` |
| `whatsapp_click` | `src/routes/__root.tsx` delegated external-link click handler; WhatsApp link is clicked | Destination hostname only |
| `partner_click` | `src/routes/partners.tsx`; partner website link is clicked | `partner_id`, destination hostname only |
| `outbound_link` | `src/routes/__root.tsx` delegated external-link click handler; non-CometX HTTP(S) link is clicked | Destination hostname only |

`purchase` is deduplicated by checkout batch/order in the browser and requires server-confirmed payment plus issued tickets; a return URL by itself is not proof of purchase. It is emitted on the successful return page, so a buyer who never returns to CometX may not be counted. Payment records remain authoritative. `payment_failed` likewise requires a failed status recorded by the server/webhook; browser-side validation alone never reports a payment failure. `payment_cancelled` records only the return from the explicit Stripe cancellation URL. These events are emitted only with analytics consent. The helper allowlists safe event properties; names, email addresses, attendee fields, order/batch keys, and raw error text are excluded. Signed-in status is not sent. A real paid membership checkout is not enabled yet; membership activation is not inferred from a CTA click, and no membership checkout-start event is fabricated.

## Funnels

- Event funnel: `events_list_view` → `event_view` → `ticket_select` → `add_to_cart` → `begin_checkout` → `purchase`.
- Member pricing funnel: `event_view` → `login_for_member_price` → `member_price_view` → `add_to_cart` → `purchase`. These events may be performed by different visitor categories; GA4 funnel exploration settings determine whether steps must occur in one session/user sequence.
- Membership interest: `membership_view` → `membership_cta_click` → (paid membership checkout, not currently available) → server-confirmed membership activation. Do not interpret CTA counts as paid conversions.
- Newsletter: successful `newsletter_signup` events.

These event counts describe actions, not user-level cohort conversion rates. Ticket metadata is supplied when it describes one event/ticket selection; aggregated multi-event carts report aggregate quantity, event count, value and currency rather than assigning a misleading single event/ticket.

## Configuration and DebugView

1. Set `VITE_GA_MEASUREMENT_ID=G-...` in the new app's local/deployment environment and restart/rebuild the app. No other GA credentials are required for browser collection.
2. Open the new CometX app in [Google Tag Assistant](https://tagassistant.google.com/) and use the GA4 property's **Admin → DebugView**. Accept analytics consent in the app; then check `page_view`, route/event details, ticket actions, `partner_click`, and other conversions as you test them.
3. Decline consent in a separate browser session and verify that no GA tag or events are sent. Use non-production data for signup, login, and newsletter checks. Do not perform a real payment just to test; a `purchase` should appear only after a confirmed paid order has issued tickets.
4. Check DebugView for exactly one `page_view` per route and for the listed event parameters. The app disables GA's automatic initial page view and emits manual SPA page views. No Wix, GA4 property, or stream settings were changed as part of this app integration.
