# Boss feedback: Events and staff roles (15 October 2026)

| Feedback | Current state in this branch | Remaining boundary |
| --- | --- | --- |
| Ticket and membership connection is confusing | Event ticket editor explains required, discount and free entitlements and reads the active plans' assigned benefits. | Entitlement definitions and plan assignments still cannot be edited in Back Office. This needs a guarded Admin-only editor and pricing regression tests; do not change live benefits casually. |
| Public event restricted to selected members | `required_entitlement` exists per ticket and the server checks the buyer's active plan at quotation/checkout. The event itself can remain public. | Check the exact public message and CTA for an ineligible visitor during a hosted acceptance test. |
| Image URLs are hard to find/manage | Existing CometX photos can be selected. This branch adds PC upload for main event, gallery and speaker photos to a dedicated Supabase Storage bucket, with JPEG/PNG/WebP and 5 MB restrictions. Uploaded URLs feed the existing fields. | Migration `0018_event_media_storage.sql` must be applied with the app release; no upload has been tested against hosted Storage. The interface can replace/remove a reference, but it does not yet delete orphaned files or provide a full media library. |
| Speakers rarely repeat | This branch adds a speaker directly inside the event editor and selects them automatically; the old list is collapsed for optional reuse. | Internally speakers remain records in the existing `speakers` table. Adding one saves that profile immediately, while attaching it requires saving the event. Truly event-owned speaker records and automatic cleanup would require a schema/workflow change. |
| Staff roles | Admin, Event manager, Data analyst and Marketing capabilities, assignment controls, and server guards are deployed to the prototype. | Restricted-role signed-in allowed/denied tests still need designated test accounts. Do not describe that acceptance as complete. |

No Stripe, Wix, ticket pricing, plan assignment or existing event record was changed for this audit.
