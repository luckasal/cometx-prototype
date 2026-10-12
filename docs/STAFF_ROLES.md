# Restricted Back Office roles

Status: permission foundation implemented; restricted roles are NOT enabled or assignable yet.
Existing Member/Admin behavior is unchanged. No existing user has been granted access.

## Permission boundaries

- Administrator: all capabilities, including role assignment, member/account management, membership edits and financial actions.
- Event manager: read/edit events and their tickets, speakers/workshops; read orders/attendees and check in tickets. No refunds, account deletion or role management.
- Data analyst: read events, attendees, orders, reports, contacts, members, memberships and payment records. No writes. Exports must respect the same read permission and must not include private access tokens or payment credentials.
- Marketing: read/edit contacts, newsletter, content/articles and partners. No financial records, event edits or staff/member management.
- Multiple staff roles combine capabilities. Paid membership tier is not a staff role.

Implemented in `src/lib/staff-permissions.ts`; `requireStaffPermission` authenticates the caller, reads their database roles and rejects missing capabilities. Unknown roles/permissions fail closed. Existing `requireAdmin` and handler guards remain in place until full integration.

## Remaining implementation sequence

1. Inspect actual hosted enum, grants and policies; generate a migration using the Supabase CLI workflow. Add the three staff roles without converting them to Admin.
2. Define per-operation RLS policies/grants for each relevant table. Keep role writes Admin-only via the trusted server. Do not redefine `is_admin()` to mean any staff role: that would grant unrestricted access through existing policies/RPCs.
3. Map every handler to a permission. Events/speakers/workshops: read vs write; check-in: `attendees.check_in`; content/contact/partner writes: corresponding write permission. Cross-section dashboard queries must not leak totals/records from forbidden sections.
4. Audit all privileged reads/RPCs. Current event metrics, orders and check-in use a server-only bypass client; authorization must run before imports/queries. Refund endpoints and account deletion remain Admin-only.
5. Restrict navigation, direct URLs, prefetch and page actions. Analyst pages need real read-only views rather than editors with a hidden save button. Event preview must recognize event-read permission without granting access to protected member content.
6. Add role controls in the member dialog, confirmation and self-lockout protection; preserve account/history and other role assignments. Refresh access and member caches after changes.
7. Test a role matrix at HTTP/server-handler and database levels, including direct RPC/Data API attempts, denied writes, combined roles, revoked-role sessions and cross-section navigation. Then coordinate migration/deployment.

## Acceptance before release

The presence of a role label or pure permission tests is not sufficient. Each role must pass allowed and denied operations on the actual restricted page and database. Until then no assignment UI is presented, existing full Admin permissions remain unchanged, and no release should claim restricted roles are complete.
