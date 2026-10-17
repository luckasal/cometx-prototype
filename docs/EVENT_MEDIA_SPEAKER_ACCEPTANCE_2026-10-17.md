# Event photos and one-off speakers: acceptance record

Task: `BOSS-P1-EVENT-MEDIA-SPEAKERS-01`. This is a code-path audit, **not** a completed hosted acceptance test. Browser control was unavailable in this session, so no hosted event, speaker, or photo was created or modified.

## Current ownership and safeguards

- PC uploads go to the public `cometx-event-media` Supabase Storage bucket, under `event-heroes/`, `event-gallery/`, or `speaker-photos/` with generated UUID names. The bucket limits files to JPEG, PNG, or WebP at 5 MB; the client checks the same limits. Public reads are intentional for public event pages. Only authenticated Admin/Event manager may insert through the storage policy.
- Event hero and gallery references live on `events`; speaker portraits live on `speakers`. A one-off speaker has `event_id` and is excluded from the global reusable list. A workshop speaker is assigned separately in Programme and workshops.
- The editor's **Remove from event** action only clears a reference after event save. It does not delete the Storage object. Replacing a photo also leaves the old object. Uploading before saving and then abandoning the form can create an orphan. Do not describe these actions as deleting the file.
- A guarded server action, `adminDeleteUnusedEventMedia`, validates a generated path, checks hero/gallery/speaker references, and refuses deletion when any reference exists. This action is not exposed in the simplified event editor. There is no automated orphan sweep or staff-facing cleanup workflow yet.
- The one-off speaker delete action checks workshop references first. The database cascades event-speaker links when its speaker row is deleted. Deleting a speaker does not delete its portrait file.

## Hosted acceptance still required

Use a designated **draft** event, an approved non-sensitive CometX image, and a designated Admin/Event manager test identity. Do not edit a real published event for this test.

1. Confirm migrations `0018_event_media_storage.sql` and `0019_event_owned_speakers.sql` are present in the hosted database and that the test identity can open the event editor.
2. Upload a hero, a gallery image, and a one-off speaker portrait from the PC. Save the draft. Reload and verify all three render on the event editor and the speaker remains event-owned, not global.
3. Replace the hero, remove the gallery reference, edit the one-off speaker, and save. Reload to verify each persisted result. Note the old media files remain in Storage.
4. Attempt to delete a speaker linked to a workshop: it must be blocked with a clear message. Detach it from the workshop and save, then delete the speaker and verify it disappears from this event without affecting reusable speakers.
5. Verify Event manager can upload/edit; Data analyst and Marketing cannot upload or invoke the write action. Confirm unauthenticated upload is denied.
6. Only after confirming an old file has no references, purge it through the guarded server action or an approved administrative Storage procedure. Recheck the public event and speaker pages. Do not bulk-delete the bucket or infer unused status from filenames alone.

Until steps 1–6 pass, task 5 remains in review. Storage cleanup UX is still an implementation gap, not a completed feature.
