# CometX content gap audit

Audit date: 24 September 2026. Source of truth: the current public pages on `cometx.ch` / `cs.cometx.ch`. The prototype structure and working Supabase flows remain authoritative for implementation; this audit concerns content coverage only.

| Area | Exists on cometx.ch | Exists in prototype | Missing / incomplete | Destination |
|---|---|---|---|---|
| Events overview | Upcoming events, previous events and descriptions of the Annual Symposium, Mix&Match, Pivní POTLA.CH, leisure activities and workshops | Supabase-backed upcoming/past event listing and event detail route | Official images were not connected to the three current events; broader event-format explanation is abbreviated | Supabase `events`; `/events` |
| 2026 Annual Symposium | Speakers, workshops, ticket guidance, location, company presentation packages, contacts and links to previous editions | A strong bilingual archive page, 2026 speaker/workshop records, ticket-type archive and partners | Partner packages, explicit contact block and previous-year navigation are absent; programme is summarized rather than represented as a dedicated section | Supabase speakers/workshops/partners where applicable; `/events/annual-symposium-2026` |
| Previous symposiums | Dedicated 2022, 2023, 2024 and 2025 pages with speakers, programmes, venues and partners | Only the completed 2026 event is prominent | No discoverable previous-edition collection | `/events/annual-symposium-2026` previous-years section linking to source archives; later migrate each edition into Supabase events if required |
| Membership | Fanoušek CHF 90, CometXXL CHF 250, Ambasador CHF 599, CHF 1.99 setup fee, exact tier benefits and general member benefits | Supabase-backed plans and benefits; correct pricing and tier contents implemented | No real payment by design; employer-contribution wording is not yet shown | Supabase membership plans/entitlements; `/membership` |
| Community articles | Blog categories and posts including Symposium retrospective, 17 November, diplomacy/science and Mix&Match | Supabase-backed articles and four real article images | Seeded article body/catalogue coverage is partial | Supabase `articles`; `/community` and article detail |
| Videos | Fan-zone/video content and external YouTube presence | YouTube appears only as a footer link | No curated video section | `/community`; links/data can later move to a dedicated Supabase content table |
| Gallery | Event photo galleries across the event pages | Event and article hero images only | No curated gallery surface | `/community`; use existing real assets first |
| Opinions | Dedicated opinions section | General articles support visibility controls | No opinions category/filter | `/community`; represent as Supabase articles without adding social/comment features |
| Get involved | Team/volunteer invitation and a dedicated open-positions page | About page mentions volunteering | No visible navigation entry or concrete open-position summary/contact CTA | New `/get-involved` route linked from header/footer |
| WhatsApp community | Prominent invitation in site footer | WhatsApp URL exists in footer social links | Invitation is not prominent and has no explanatory CTA | Homepage/community CTA and footer |
| Newsletter | Site-wide signup with name, surname, email, expertise and language interests | Not implemented; email integration intentionally deferred | Missing signup surface | Informational newsletter CTA linking to the official CometX signup/page; do not store submissions until integration is approved |
| Partners | Partner directory, logos and symposium presentation packages | Supabase-backed partner directory and event partners | Company presentation packages missing from symposium page | `/partners`; symposium partner-packages section |
| Footer/contact/legal | Registration number, address, email, IBAN/BIC, terms, privacy and social links | Address, registration number, email and social links | IBAN/BIC and terms/privacy links absent; newsletter/WhatsApp weak | Shared `SiteFooter` |
| Core application | Public site plus Wix member/event commerce | Supabase authentication, profiles, memberships, events, registrations, account and admin | Stripe/email intentionally excluded; no messaging/comments/social network by design | Preserve existing routes and backend |

## Implementation priority

1. Connect the three official event images already stored in `public/assets/cometx`.
2. Remove the homepage interactive-demo CTA.
3. Complete the symposium archive with partner packages, contacts and previous-year links using sourced facts only.
4. Expand `/community` with sourced article, video/gallery and opinions entry points without adding social features.
5. Add a focused `/get-involved` page and navigation.
6. Strengthen WhatsApp/newsletter calls to action and complete the shared footer with sourced legal/contact links.
7. Keep recurring event, membership, speaker, workshop, partner and article records in Supabase; keep stable navigation/legal/source links in code.
