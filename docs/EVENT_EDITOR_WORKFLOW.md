# Event editor: current staff workflow

This note covers the task-3 feedback increment. It does not change checkout or existing event data.

## Ticket benefits

In an event's **Tickets** section, the membership reference now shows which benefits belong to each active plan. The three ticket selectors have different meanings:

- **Requires entitlement** limits purchase to a member who has that benefit.
- **Discount entitlement** uses the benefit's configured percentage where applicable.
- **Free with entitlement** makes an eligible ticket free where applicable.

The selectors reference existing benefits; they do not create benefits or assign them to plans. The **Memberships** page currently displays plan assignments but does not edit them. A separate admin-only editor with confirmation and pricing tests is still required before staff can change the promises made to existing members.

## Photos

The event's **Edit content** section now offers five existing CometX event photos. Choosing one stores a relative `/assets/cometx/...` path, so a draft saved locally will still load the photo on the deployed site. Staff may paste a public, approved image URL instead. The selection is only a reference to a file already hosted with the website; it is not an upload or shared media library. New-photo upload, validation, rights review, and lifecycle management remain follow-up work.

## Speakers

Speaker profiles are managed under **Back Office → Speakers**. Staff can create a new profile for a one-off speaker; a profile does not imply the person must appear at multiple events. Select the profiles in the event's **Speakers** section and save the event. Workshop speaker assignment is separate under **Programme and workshops**. After creating a speaker in another tab, refresh the event editor to see the new profile.
