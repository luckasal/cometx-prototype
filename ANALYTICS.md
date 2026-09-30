# CometX analytics (GA4)

Set `VITE_GA_MEASUREMENT_ID=G-...` in the site's environment and rebuild/redeploy. The ID is a public browser identifier; do not put API secrets in `VITE_` variables. If `VITE_GTM_CONTAINER_ID` is set, the existing GTM path takes precedence instead; configure its GA4 tag to consume the same data-layer events and do not run a second GA4 tag.

| Event | When sent | Properties (when available) |
| --- | --- | --- |
| `page_view` | Initial public page and SPA pathname changes, excluding `/admin` | Sanitized `page_location`, `page_title`, sanitized previous `page_referrer` |
| `event_view` | Published event detail is loaded | `event_slug`, `event_id` |
| `membership_view` | Membership page opens | — |
| `ticket_add_to_cart` | Ticket is added from event detail | `event_slug`, `event_id`, `ticket_type`, `ticket_type_id`, `quantity`, `value`, `currency` |
| `cart_view` | Cart opens | `quantity`, `event_count` |
| `checkout_start` | A paid checkout session is created | `quantity`, `event_count`, `value`, `currency` |
| `purchase_success` | Payment-return page loads confirmed paid order(s) with issued tickets | `quantity`, `event_count`, `value`, `currency` |
| `newsletter_signup` | Footer subscription succeeds | `placement` |
| `login` | Password login succeeds | `method` |
| `membership_cta_click` | Header/home join CTA or membership selection CTA is clicked | `placement` or `plan`, optional `destination` |

The shared helper in `src/lib/analytics.ts` allowlists event metadata. It does not transmit buyer/attendee names, email, order IDs or private ticket tokens. Page locations and referrers always omit query strings and fragments, including on private guest-ticket links. `purchase_success` is deduplicated locally per checkout batch/order and requires a paid payment, confirmed order and issued tickets; it is not fired for pending, free, failed or unissued orders. It is a browser event on the successful return page, so purchases where the buyer never returns to CometX are not counted by this client-side signal; Stripe/Supabase remain the authoritative revenue record.

## Verify

1. Add the measurement ID to the staging environment and redeploy. Open the site through [Google Tag Assistant](https://tagassistant.google.com/) and inspect GA4 **Admin → DebugView**.
2. Navigate between `/events`, one event, `/membership`, and `/cart`; check each expected event and its parameters. Test login and newsletter signup with non-production data.
3. In Stripe test mode, finish a paid purchase and wait until tickets are issued. Only then should one `purchase_success` appear for that checkout. A free or cancelled checkout must not send it.
4. In GA4 web-stream Enhanced Measurement, turn off **Page changes based on browser history events** because this app sends manual SPA `page_view` events. Otherwise navigation may be double-counted (and private guest URL query strings may be captured by the automatic collector). Do the same for any GTM history triggers.

Before enabling analytics on a production domain, review consent and privacy requirements and connect the site's consent mechanism; this task adds tracking only, not a consent banner.
