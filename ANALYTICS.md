# CometX analytics (GA4)

Set `VITE_GA_MEASUREMENT_ID=G-...` in the site's environment and rebuild/redeploy. The ID is a public browser identifier; do not put API secrets in `VITE_` variables. If `VITE_GTM_CONTAINER_ID` is set, the existing GTM path takes precedence instead; configure its GA4 tag to consume the same data-layer events and do not run a second GA4 tag.

| Event | When sent | Properties (when available) |
| --- | --- | --- |
| `page_view` | Initial public page and SPA pathname changes, excluding `/admin` | Sanitized `page_location`, `page_title`, sanitized previous `page_referrer` |
| `event_view` | Published event detail is loaded | `event_slug`, `event_id`, `event_type` |
| `membership_view` | Membership page opens | — |
| `ticket_select` | Visitor changes a ticket quantity from zero to a positive value | `event_slug`, `event_id`, `event_type`, `ticket_type`, `ticket_type_id`, `quantity`, `value`, `currency`, optional `membership_tier` |
| `add_to_cart` | Ticket is added from event detail | `event_slug`, `event_id`, `event_type`, `ticket_type`, `ticket_type_id`, `quantity`, `value`, `currency`, optional `membership_tier` |
| `cart_view` | Cart opens | `quantity`, `event_count` |
| `begin_checkout` | A paid ticket checkout session is created | `quantity`, `event_count`, `value`, `currency`; for a single ticket type also event/ticket metadata |
| `purchase` | Payment-return page loads confirmed paid order(s) with issued tickets | `quantity`, `event_count`, `value`, `currency` |
| `newsletter_signup` | Footer subscription succeeds | `placement` |
| `login` | Password login succeeds | `method` |
| `membership_cta_click` | Header/home join CTA or membership selection CTA is clicked | `placement` or `plan`, optional `destination` |
| `membership_activated` | Account return page confirms an active membership after successful checkout | `membership_tier` |
| `signup` | New account creation succeeds | `method` only |
| `outbound_link` | Public external link is clicked | Destination hostname only |
| `whatsapp_click` | External WhatsApp link is clicked | Destination hostname only |

The shared helper in `src/lib/analytics.ts` allowlists event metadata. It does not transmit buyer/attendee names, email, order IDs or private ticket tokens. Page locations and referrers always omit query strings and fragments, including on private guest-ticket links. `purchase` is deduplicated locally per checkout batch/order and requires a paid payment, confirmed order and issued tickets; it is not fired for pending, free, failed or unissued orders. It is a browser event on the successful return page, so purchases where the buyer never returns to CometX are not counted by this client-side signal; Stripe/Supabase remain the authoritative revenue record. Membership activation is emitted only after the return route sees the server-confirmed active membership.

## Verify

1. Add the measurement ID to the staging environment and redeploy. Open the site through [Google Tag Assistant](https://tagassistant.google.com/) and inspect GA4 **Admin → DebugView**.
2. Navigate between `/events`, one event, `/membership`, and `/cart`; check each expected event and its parameters. Test login and newsletter signup with non-production data.
3. In Stripe test mode, finish a paid purchase and wait until tickets are issued. Only then should one `purchase` appear for that checkout. A free or cancelled checkout must not send it.
4. In GA4 web-stream Enhanced Measurement, turn off **Page changes based on browser history events** because this app sends manual SPA `page_view` events. Otherwise navigation may be double-counted (and private guest URL query strings may be captured by the automatic collector). Do the same for any GTM history triggers.

GA4 and GTM now load only after a visitor selects **Allow analytics** in the site consent prompt. Declining stores the choice and leaves tracking off. The footer **Analytics settings** control reopens the choice; withdrawing consent reloads the page to remove previously loaded tags. The setting is browser-local and applies to public routes only; `/admin` is excluded from visitor tracking. External link tracking sends only the destination hostname, never full URLs or WhatsApp invite codes. Review the consent text and privacy notice with CometX before production launch.

## Staff dashboard

`/admin/analytics` shows the previous 30 complete days of GA4 visitors, sessions, page views, acquisition channels, popular page paths, and event counts for the ticket, membership, newsletter, and link journeys. The main `/admin` page links to it. The report is fetched only by an authenticated administrator through the GA4 Data API; credentials are never returned to the browser. Empty or absent events appear as a dash. These are independent event totals rather than user-level funnel conversion rates, and `purchase` still has the return-page limitation described above. The current membership screen is a preview flow without paid membership checkout; membership checkout-start and paid activation counts remain unavailable until a real paid membership path is enabled.

Set these **server-only** deployment variables to enable the report:

- `GA4_PROPERTY_ID`: numeric GA4 property ID, distinct from the public `G-...` Measurement ID.
- `GA4_CLIENT_EMAIL`: Google Cloud service account email.
- `GA4_PRIVATE_KEY`: its PEM private key. Store it as a secret; literal `\n` escapes are accepted.

Enable the Google Analytics Data API in the service account's Google Cloud project and grant that service account Viewer access to the GA4 property. Redeploy, open `/admin/analytics` as staff, and compare the previous 30 complete days with GA4 Reports. No property or credentials are bundled into client JavaScript. Google Data API requests use the [official `runReport` endpoint](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport).
