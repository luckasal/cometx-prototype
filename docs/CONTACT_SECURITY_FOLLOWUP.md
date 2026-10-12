# Contact security follow-up

Saved 2026-10-12 at the user's request. Revisit after STAFF-ROLES-INTEGRATION-01; this is a backlog, not a completed security audit or permission to change staff access now.

## Existing protections and boundaries

- Server verifies Supabase identity and current database role before privileged handlers.
- Hosted preflight on 2026-10-12 confirms contacts and user_roles RLS enabled, contacts policy restricted to is_admin(), own role reads only (or Admin), and is_admin() still checks the admin role alone.
- Restricted staff access is mediated by guarded server handlers; service credentials bypass RLS and must remain server-only.
- Current permission matrix lets Marketing read/edit/export contacts and Data analysts read/export. Event managers have event buyer/attendee information, not the contact directory. Paid membership does not grant staff access.
- CSV exports cannot be recalled when a role is removed. Read-only access still permits copying. Hosted restricted-account E2E remains a release verification item.

## Prioritized next task

1. Enforce staff MFA, and check Supabase/Vercel account MFA; do not claim enforcement currently exists.
2. Separate contact export permission from read access, default narrowly, and agree who needs it.
3. Agree whether analysts should receive aggregate/anonymized reporting instead of identifiable contact records. Do not silently change the approved role matrix.
4. Restrict private notes and unnecessary personal fields; document collection/retention purposes.
5. Record audit events for contact changes/deletion/exports and staff role changes, avoiding raw personal data in logs.
6. Correct consent provenance: saving an already subscribed contact currently resets consent_at. Preserve historical evidence; a manual status edit is not proof of opt-in. Decide double opt-in requirements separately.
7. Verify hosted allow/deny API and database tests, related views/RPCs, and backups/restoration. Local tests alone are not certification.

No contact records, consent state, exports, MFA settings or role assignments were modified while saving this follow-up. Wix must remain read-only.
