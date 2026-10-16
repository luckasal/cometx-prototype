# Boss feedback audit — 16 October 2026

Scope: current CometX working branch and the already-observed hosted Back Office. This is a code/UI audit, not a fresh purchase, file upload, role-switch or accounting acceptance test. No customer record, plan assignment, Stripe charge or database schema was changed for this audit. The prioritized work is tracked in `.ai/TASKS.md` as `BOSS-*` tasks.

## Priority 0: event tickets and member promises

| Feedback | Verified current behavior | Gap / next acceptance |
| --- | --- | --- |
| Tickets and memberships are hard to connect | Ticket editor groups public price, sales dates, buyer eligibility and member price. Required entitlement is per ticket; an event can remain public. The editor lists eligible active plans. `/admin/plans` has Admin-only benefit wording and assignment controls. Locally, the stale read-only guidance is corrected and an ineligible visitor gets membership/sign-in links. | Add a single understandable eligibility/price preview. Test the new public CTA and server denial on the hosted site. `BOSS-P0-ENTITLEMENT-EDITOR-01`. |
| Signed-in member pricing | `events.functions.ts` loads the active membership/entitlements; `pricing.ts` calculates the displayed ticket price; checkout remains server-authoritative. One benefit-priced ticket per member/event is intended and workshop credit is selectable in cart, once per membership term. My CometX now distinguishes used from checkout-reserved credit. | Run a controlled cross-plan test matrix through event page → cart → Stripe sandbox → confirmed order. Include two tickets, prior-order repeat, expiry and refund. Do not change the currently promised benefits from UI interpretation alone. `BOSS-P0-MEMBER-PRICING-ACCEPTANCE-01`. |
| What benefits belong to each plan? | `/admin/plans` shows human-readable plan benefits and expandable Admin editing of benefit wording/assignments. Fixed workshop credits are CHF 100/300. The `potlach_discount` definition exists but has no plan assignment on the observed hosted page. Local My CometX copy no longer repeats known percentage labels. | Reconcile unused/historical keys, the public plan cards, My CometX wording and event pricing into one source of truth. Avoid exposing raw value `1`. `BOSS-P1-MEMBERSHIP-BENEFITS-01`. |

## Priority 1: event content and staff access

| Feedback | Verified current behavior | Gap / next acceptance |
| --- | --- | --- |
| Where do image URLs come from? | Event hero, gallery and one-off speaker portrait have PC file pickers; staff do not need to paste URLs in the event editor. Files are stored in the dedicated Supabase event-media bucket; removing an event reference does not delete the file. | A real hosted upload/replace/remove test with an approved image is still missing. There is no simple media-library or orphan cleanup workflow in this editor. `BOSS-P1-EVENT-MEDIA-SPEAKERS-01`. |
| Speakers rarely repeat | Staff can draft a speaker in the event editor; one-off profiles are event-owned and editable there. The shared Speakers list remains for reusable profiles; workshop speaker selection is separate. | Test create/edit/detach/delete and workshop references on the hosted site. Explain the distinction in the editor; do not force staff to manage a global list for one-off speakers. `BOSS-P1-EVENT-MEDIA-SPEAKERS-01`. |
| Staff roles | Admin, Event manager, Data analyst and Marketing roles have assignment controls and server permission guards. | No completed signed-in allowed/denied matrix for the three restricted roles. Use designated accounts and verify both navigation and server actions before claiming full acceptance. `BOSS-P1-STAFF-ROLE-ACCEPTANCE-01`. |
| Slow Back Office | Access checking was simplified and page reads parallelized in earlier releases. Prior authenticated UI observations were roughly 2–3 seconds for Members, Contacts and Events. | No request waterfall or reliable before/after baseline exists. Measure role lookup and each page fetch separately, cold and warm, before changing caching or guards. `BOSS-P1-BACKOFFICE-LATENCY-01`. |

## Priority 2: contacts, newsletter, content and partners

| Feedback | Verified current behavior | Gap / next acceptance |
| --- | --- | --- |
| “Link to member” | A contact is a lead/newsletter/guest identity, separate from an authenticated account. The optional `member_id` associates the records; it does not itself grant membership or merge purchases. | Rename/explain the field, show linked account and active membership safely, and define a guided invitation/assignment flow. `BOSS-P2-CONTACT-CRM-01`. |
| LinkedIn and birth year | Neither field is present in the contact form/schema path inspected. | Agree collection purpose, visibility and retention with Lucka Piecková before adding personal data. `BOSS-P2-CONTACT-CRM-01`. |
| Bulk contacts and segments | Contacts support search, newsletter-status filter, individual edit and CSV export; Newsletter is a subscribed-contacts view. | No bulk import/edit or segment taxonomy. Export currently downloads only the loaded, filtered latest 500 rows, so it must not be represented as a full-database export. Add preview/deduplication/consent provenance and audited bulk actions. `BOSS-P2-CONTACT-BULK-01`. |
| Email campaign statistics | Sending and open tracking are not provided by the current Newsletter page. | Choose an external emailing platform and consent-sync contract with Lucka Piecková and Julia Šťastná; then decide which summaries, if any, belong in Back Office. `BOSS-P3-NEWSLETTER-PAYMENTS-COMMUNITY-01`. |
| Content versus photos | Articles have their own Back Office tab; the Content section is for publishable content, not the event-photo upload workflow. | Clarify labels and ownership before adding more navigation. Premium community listings need moderation, eligibility and privacy decisions first. `BOSS-P3-NEWSLETTER-PAYMENTS-COMMUNITY-01`. |
| Partners | Partner editor has name, tier, website, logo URL, description and visibility. | No filtering, PC logo upload, internal sector or collaboration dates. Check where public description renders before changing the schema/UI. `BOSS-P2-PARTNERS-CONTENT-01`. |

## Priority 3: payments and product decisions

Payments Back Office currently lists records/documents but does not generate on-demand invoices or enter bank receipts. Define the accounting owner and reconciliation rules before building either; manual receipt entry must never masquerade as a Stripe-paid order. Premium “advertisements” are a new moderated community product, not a small extension of the existing article form. Track both under `BOSS-P3-NEWSLETTER-PAYMENTS-COMMUNITY-01` after event/member acceptance.

## Recommended sequence

1. Freeze current plan promises and capture a signed-off benefit matrix from CometX staff.
2. Run `BOSS-P0-MEMBER-PRICING-ACCEPTANCE-01`, then correct any verified pricing/eligibility mismatch.
3. Simplify ticket/benefit editing and customer eligibility copy; reconcile benefit labels across public plans and My CometX.
4. Complete hosted media/speaker and restricted-role write/deny acceptance.
5. Scope contact/newsletter/partner improvements with the responsible staff; leave invoice/community features as decisions until requirements exist.

Existing historical notes in `docs/BOSS_EVENT_FEEDBACK_AUDIT.md` describe earlier stages and contain outdated release-status statements; use this dated audit plus the current code/hosted checks for planning.

Local follow-up in this cycle has not been deployed. Focused pricing/benefit and ticket-availability tests pass. The full build was not verified: local Nitro dependency-link creation hit Windows EPERM, and the unsandboxed retry was denied by automatic approval. This does not establish hosted purchase, upload, role or refund acceptance.
