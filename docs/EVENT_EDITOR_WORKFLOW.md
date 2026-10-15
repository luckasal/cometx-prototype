# Event editor: current staff workflow

This note covers the task-3 feedback work. It does not change checkout or existing event data.

## Ticket benefits

In an event's **Tickets** section, the membership reference now shows which benefits belong to each active plan. The three ticket selectors have different meanings:

- **Requires entitlement** limits purchase to a member who has that benefit.
- **Discount entitlement** uses the benefit's configured percentage where applicable.
- **Free with entitlement** makes an eligible ticket free where applicable.

The selectors reference existing benefits; they do not create benefits or assign them to plans. The **Memberships** page currently displays plan assignments but does not edit them. A separate admin-only editor with confirmation and pricing tests is still required before staff can change the promises made to existing members.

## Photos

The event's **Edit content** section offers five existing CometX event photos. Choosing one stores a relative `/assets/cometx/...` path, so a draft saved locally will still load the photo on the deployed site. Staff can also upload a main photo or gallery photos from their computer, or paste an approved public URL in the advanced section. The upload accepts JPEG, PNG or WebP up to 5 MB in a public Supabase Storage bucket. Apply migration `0018_event_media_storage.sql` with the matching app release before using it; until then uploads will fail gracefully. Uploading stores a file immediately, but saving the event is still required to attach its URL. Clearing an event image reference does not delete the stored file. A managed media library, orphan cleanup and image-rights review are still needed.

## Speakers

Staff can add a one-off speaker directly in an event's **Speakers** section, including a portrait upload. This immediately saves the internal speaker record and selects it in the editor; save the event to attach it. For rare repeat appearances, open the collapsed existing-speaker list. The standalone **Back Office → Speakers** page still allows editing or removing an unused profile. Workshop speaker assignment is separate under **Programme and workshops**. An unused inline speaker record is not automatically deleted if the event is abandoned.
