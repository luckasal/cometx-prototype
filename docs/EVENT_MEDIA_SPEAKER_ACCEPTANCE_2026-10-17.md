# Event photos and one-off speakers: acceptance record

Task: `BOSS-P1-EVENT-MEDIA-SPEAKERS-01`. This is a code-path audit and partial hosted visual check, **not** a completed hosted write-path acceptance test. Commit `eba7cff` is live on the canonical Production domain. The signed-in admin editor shows the Advanced cleanup panel and its Main photos list loads. No hosted event, speaker, or photo was created or modified.

On 18 October, the signed-in hosted New event editor again showed the three PC image pickers and inline speaker fields. An unpublished QA form was filled but **not saved**. The browser's file-upload permission was declined before any file transfer; do not retry via another browser, tool or API. Ten local media/content/schedule checks passed. Hosted upload, speaker CRUD, cleanup and role-denial acceptance remain unverified.

## Current ownership and safeguards

- PC uploads go to the public `cometx-event-media` Supabase Storage bucket, under `event-heroes/`, `event-gallery/`, or `speaker-photos/` with generated UUID names. The bucket limits files to JPEG, PNG, or WebP at 5 MB; the client checks the same limits. Public reads are intentional for public event pages. Only authenticated Admin/Event manager may insert through the storage policy.
- Event hero and gallery references live on `events`; speaker portraits live on `speakers`. A one-off speaker has `event_id` and is excluded from the global reusable list. A workshop speaker is assigned separately in Programme and workshops.
- The editor's **Remove from event** action only clears a reference after event save. It does not delete the Storage object. Replacing a photo also leaves the old object. Uploading before saving and then abandoning the form can create an orphan. Do not describe these actions as deleting the file.
- A guarded server action, `adminDeleteUnusedEventMedia`, validates a generated path, checks hero/gallery/speaker references, and refuses deletion when any reference exists. The event editor now exposes it under **Advanced: clean up unused uploaded photos**, grouped by hero/gallery/speaker scope. Files selected in the unsaved form are disabled. This is an explicit, one-file-at-a-time cleanup with confirmation, not an automated orphan sweep.
- The one-off speaker delete action checks workshop references first. The database cascades event-speaker links when its speaker row is deleted. Deleting a speaker does not delete its portrait file.

## Hosted acceptance still required

Use a designated **draft** event, an approved non-sensitive CometX image, and a designated Admin/Event manager test identity. Do not edit a real published event for this test.

1. Confirm migrations `0018_event_media_storage.sql` and `0019_event_owned_speakers.sql` are present in the hosted database and that the test identity can open the event editor.
2. Upload a hero, a gallery image, and a one-off speaker portrait from the PC. Save the draft. Reload and verify all three render on the event editor and the speaker remains event-owned, not global.
3. Replace the hero, remove the gallery reference, edit the one-off speaker, and save. Reload to verify each persisted result. Note the old media files remain in Storage.
4. Attempt to delete a speaker linked to a workshop: it must be blocked with a clear message. Detach it from the workshop and save, then delete the speaker and verify it disappears from this event without affecting reusable speakers.
5. Verify Event manager can upload/edit; Data analyst and Marketing cannot upload or invoke the write action. Confirm unauthenticated upload is denied.
6. After saving the removed reference, open **Advanced: clean up unused uploaded photos**. Confirm the attached file is protected, then delete one unreferenced file and verify it disappears from the list. Recheck the public event and speaker pages. Do not bulk-delete the bucket or infer unused status from filenames alone.

Until steps 1–6 pass, task 5 remains in review. The cleanup UI and its guarded server path pass a local build, but hosted write-path acceptance is not complete.
