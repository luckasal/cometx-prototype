# Event editor: current staff workflow

This note covers the task-3 feedback work. It does not change checkout or existing event data.

## Ticket benefits

In an event's **Tickets** section, each ticket now groups the everyday decisions:

1. **When can people buy?** An empty ticket window uses the event registration window; the earliest dated ticket sets the event registration opening.
2. **Who can buy?** Choose a public ticket or require a benefit held by an active member. The editor lists the active plans that currently have a selected benefit. The event can remain public while its tickets are member-restricted.
3. **What does a member pay?** Event-type membership benefits apply automatically. A fixed member price is optional and is used only where the pricing engine supports it; free admission takes priority.

The optional extra percentage/free-ticket selectors are under **Advanced** and show only benefits relevant to the event type, while preserving any legacy selection. The plan-benefit reference is collapsible and labels percentages, CHF workshop credits and included benefits instead of showing unexplained numbers.

These controls reference existing benefits; they do not create benefits or assign them to plans. The **Memberships** page currently displays plan assignments but does not edit them. A separate admin-only editor with confirmation and pricing tests is still required before staff can change the promises made to existing members.

## Photos

The event's **Edit content** section offers five existing CometX event photos and a browser for uploaded photos. Choosing one stores a relative `/assets/cometx/...` path; uploaded main, gallery and speaker photos are JPEG, PNG or WebP, up to 5 MB, in the public `cometx-event-media` bucket. Uploads happen immediately; save the event to attach the URL. The uploaded-photo browser lets staff reuse photos and permanently delete photos only after the server confirms no event or speaker still references them. A shared photo in an unsaved draft is protected in the editor. Applying migrations `0018_event_media_storage.sql` and `0019_event_owned_speakers.sql` with the matching app release is required; the feature has not yet been verified against hosted Storage. Image rights review remains a staff responsibility.

## Speakers

Staff can add a one-off speaker directly in an event's **Speakers** section, including a portrait upload. New speakers remain in the form until the event is saved, so abandoning the form does not leave a speaker record. Saved one-off speakers are linked to that event and can be edited or deleted inside the event editor. The optional reusable-speaker list contains only shared speaker profiles plus profiles belonging to the current event. The standalone **Back Office → Speakers** page remains for reusable profiles. Workshop speaker assignment is separate under **Programme and workshops**; it loads shared speakers and this event's speakers. Deleting a one-off speaker is blocked while a workshop still references them.
