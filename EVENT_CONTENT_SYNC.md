# Official event content sync — 25 September 2026

Updated the three existing published workshops through the deployed `/admin` CMS. Content remains in Supabase, not in page components. No new events, registrations, ticket types, capacity rules or membership discounts were created.

| Prototype slug | Official source | Verified Swiss-local schedule | Speaker |
| --- | --- | --- | --- |
| `emocni-regulace-v-kazdodenni-praxi` | https://cs.cometx.ch/event-details-registration/emocni-regulace-workshop | 17 October 2026, 14:00–18:00 | Tereza Hrušková |
| `co-ai-nevyresi` | https://www.cometx.ch/event-details-registration/co-ai-nevyresi | 15 January 2027, 14:00–18:00 | Dana Bérová |
| `jak-resit-konflikty-s-toxickymi-osobnostmi` | https://www.cometx.ch/event-details-registration/jak-resit-konflikty-s-toxickymi-osobnostmi | 12 March 2027, 13:00–19:00 | Radim Pařík |

## Changes

- Replaced placeholder short/long descriptions with original Czech workshop information, organized into the existing optional editorial sections. Corrected obvious stray source characters/typos without changing meaning.
- Set all three event types to `workshop`; preserved their slugs, publication states, ticket identities, existing prices/deadlines and capacities.
- Added end times, corrected start times, and corrected the conflict date from 11 to 12 March. The live original page says 12 March; cached search results still show 11 March. Prefer the live page.
- Emotional-regulation venue: Altstadthaus Quartiertreff, Obmannamtsgasse 15, 8001 Zürich, Switzerland. The other two events still explicitly have an unannounced Zurich venue.
- Set hero images to the existing CometX assets (`emotional-regulation.jpg`, `ai-workshop.jpeg`, `conflict-workshop.jpg`) on the deployed asset host.
- Linked the three existing speaker records and filled their roles and biographies from the official event pages. Preserved existing speaker photos; no duplicate speakers created.
- Original pages contain no timed multi-session agenda or additional capacity/member-discount data. No such information was fabricated.

## Scope and caveats

This sync covers the three workshops above, not the separately maintained symposium archive or other listed events. Source biographies include CometX's published claims; they were not independently reverified. Existing unpaid reservation behavior is unchanged; this is not a Stripe checkout release.

No application/schema migration or redeployment required: CMS saves update the shared Supabase records. External reading/book links from the originals are not part of the current structured event model.
