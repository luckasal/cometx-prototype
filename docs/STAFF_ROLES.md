# Restricted Back Office roles

Status: application integration and hosted role-label migration are deployed to the CometX prototype. Restricted-account sign-in and allowed/denied end-to-end checks are pending. No restricted role has been granted to an existing user.

The member detail dialog supports assigning/unassigning Event manager, Data analyst and Marketing independently, with confirmation and self-change protection. Admin assignment/removal remains separate and full-admin-only. Role names alone appear in the table.

Handlers check their capability before using a privileged client. Full Admin operations retain the existing caller-scoped RLS client. Restricted staff access is server-mediated; existing direct Data API/RPC RLS/grants stay unchanged. The enum migration adds labels only, and must never broaden is_admin(). Analyst views for Events/Contacts/Members/Plans contain no editing forms or mutation actions, and provide projected CSV exports of loaded records only. Orders/Registrations/Payments are already read-only; analytics requires reports.read. Navigation and direct-route guards reject unavailable sections; scoped handlers remain authoritative even when cached navigation is stale.

## Permission boundaries

- Administrator: all capabilities, including role assignment, member/account management, membership edits and financial actions.
- Event manager: read/edit events and their tickets, speakers/workshops; read orders/attendees and check in tickets. No refunds, account deletion or role management.
- Data analyst: read events, attendees, orders, reports, contacts, members, memberships and payment records. No writes. Exports must respect the same read permission and must not include private access tokens or payment credentials.
- Marketing: read/edit contacts, newsletter, content/articles and partners. No financial records, event edits or staff/member management.
- Multiple staff roles combine capabilities. Paid membership tier is not a staff role.

Implemented in `src/lib/staff-permissions.ts`; `requireStaffPermission` authenticates the caller, reads their database roles and rejects missing capabilities. Unknown roles/permissions fail closed. Financial mutation/account deletion/role management remain full-admin-only.

## Hosted release sequence

1. Supabase login restored; verified existing CometX Prototype project vlcssswzlvamtscyobbv on 2026-10-12.
2. Applied CLI-generated `supabase/migrations/20261012173752_restricted_staff_roles.sql` through SQL Editor with explicit BEGIN/COMMIT. Postflight confirms all five labels, RLS enabled on contacts/user_roles, unchanged Admin-only contacts policy, own_read user_roles policy and Admin-only is_admin(). Assignments remain six user roles and two Admin roles, no restricted grants. The initial editor replacement produced a syntax error before DDL; replaced the complete buffer and verified successful execution. No unrelated migrations applied.
3. The tested app was deployed to Production as Vercel `2DetfcmyNmDS4fWHyyW375y4EcKa` on 2026-10-14. Existing Admin member reads and role controls were verified without changing assignments. No Stripe credential/payment change was required.
4. Use designated test accounts for each restricted role; verify allowed reads/writes, denied direct handler/RPC calls, forbidden section URLs, role removal, combined roles and analyst export/read-only views. No real account should be used for destructive tests.
5. Review UI and data-access logs before certifying hosted E2E completion. Only then assign staff roles to the intended people.

The hosted check needs three dedicated temporary sign-ins controlled by the tester. Assign one restricted role to each, then verify:

| Role | Allowed | Denied |
| --- | --- | --- |
| Event manager | Event editor, ticket setup, attendee list and check-in on a disposable draft/test event | Contacts, refunds, role assignment and account deletion |
| Data analyst | Reports and read-only Events, Contacts, Members, Orders and Payments, including projected CSV export | All save, delete, refund and role-assignment actions |
| Marketing | Contacts, newsletter, content and partners using a disposable test contact | Event editing, Orders, Payments, refunds and role assignment |

Also verify a combined Event manager + Marketing account, then remove one role and confirm the corresponding access disappears on refresh and at the server handler. Remove all temporary roles, records and test accounts after checking that they have no financial or membership history. Do not use a real member for destructive test operations.

## Acceptance before release

The presence of a role label or pure permission tests is not sufficient. Each role must pass allowed and denied operations on the actual restricted page and database. Local checks cover handler permission mapping, assignment/revocation behavior, authorization failures, route/view boundaries and actual isolated PostgreSQL enum/RLS tests. The hosted migration is applied; hosted authenticated restricted-account E2E remains pending.
