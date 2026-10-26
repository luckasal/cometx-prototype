# Event editor: current staff workflow

This note covers the task-3 feedback work. It does not change checkout or existing event data.

## Ticket benefits

In an event's **Tickets** section, each ticket now groups the everyday decisions:

1. **When can people buy?** An empty ticket window uses the event registration window; the earliest dated ticket sets the event registration opening.
2. **Who can buy?** Choose a public ticket or require a benefit held by an active member. The editor lists the active plans that currently have a selected benefit. The event can remain public while its tickets are member-restricted.
3. **What does a member pay?** The editor previews the effective price for every active plan using the same pricing rules as checkout. A required benefit shows which plans can buy the ticket; if no active plan has it, the editor warns that members cannot buy. A fixed member price is optional and is used only where the pricing engine supports it; free admission takes priority. Workshop credit is displayed as an optional one-time checkout choice, not included in the default price.

The optional extra percentage/free-ticket selectors are under **Advanced** and show only benefits relevant to the event type, while preserving any legacy selection. The plan-benefit reference is collapsible and labels percentages, CHF workshop credits and included benefits instead of showing unexplained numbers.

These controls reference benefits configured in **Back Office → Membership plans → Membership benefits**. Follow the event editor's link to open the benefit catalog directly. Full Admins can update a benefit's public wording while its stable key remains fixed, assign/remove it from a plan (with confirmation), and change supported percentage values. Workshop credits stay locked to the currently supported CHF 100 / CHF 300 values. Newly created benefits are access-only and can gate an event/content item; they do not invent a discount rule. Changes affect future checkouts and access checks; existing order prices remain snapshots.

## Admin ticket counts

The event list, overview and ticket editor distinguish issued tickets from legacy registrations. **Tickets issued** counts valid/checked-in ticket records and matches the event's Guests roster. **Legacy registrations** counts confirmed/check-in rows from the older registration flow; these may have no order or ticket code. **Capacity committed** includes confirmed/free ticket-order quantities plus legacy registrations, so it can be higher than the issued-ticket count. Revenue remains a separate order/registration total.

The new migration `0020_one_member_benefit_ticket_per_event.sql` limits member pricing/free admission to one ticket per event and membership, including across separate orders. When a buyer checks out multiple tickets of one type, the order records separate discounted and public-price lines so the Stripe total and per-attendee benefit allocation agree. This SQL change is local until its hosted Supabase migration and matching app release are coordinated.

## Photos

The event's **Edit content** section now offers only PC upload for the main image, optional gallery images and speaker portraits. Existing image references remain visible as previews and can be removed from the event or speaker without deleting the stored file. Main/gallery URL fields, preloaded image choices and the uploaded-photo browser are no longer shown in this editor. Uploads accept JPEG, PNG or WebP up to 5 MB in the public `cometx-event-media` bucket. Uploading stores the file immediately; saving the event (or an existing speaker) attaches its URL. Applying migrations `0018_event_media_storage.sql` and `0019_event_owned_speakers.sql` with the matching app release is required; the feature has not yet been verified against hosted Storage. Image rights review remains a staff responsibility.

## Speakers

Staff can add a one-off speaker directly in an event's **Speakers** section, including a portrait upload. New speakers remain in the form until the event is saved, so abandoning the form does not leave a speaker record. Saved one-off speakers are linked to that event and can be edited or deleted inside the event editor. The optional reusable-speaker list contains only shared speaker profiles plus profiles belonging to the current event. The standalone **Back Office → Speakers** page remains for reusable profiles. Workshop speaker assignment is separate under **Programme and workshops**; it loads shared speakers and this event's speakers. Deleting a one-off speaker is blocked while a workshop still references them.
