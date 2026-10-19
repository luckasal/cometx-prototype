# Hosted database security-advisor review — 19 October 2026

Project: `CometX Prototype` (`vlcssswzlvamtscyobbv`). This is a read-only review of the live Security Advisor, `pg_proc`, trigger bindings, current RLS policy references, and repository callers. No role grants, functions, Auth settings or customer records were changed. An advisor warning is an exposure signal, not evidence of abuse.

## Current findings

The live advisor reports 7 anonymous and 8 authenticated `SECURITY DEFINER` execution warnings, one mutable function search path, and disabled leaked-password protection. It also reports 10 ticket/checkout tables with RLS enabled and no policy (informational; these appear designed for server-only access and need separate access-model review). All eight warned definer functions are owned by `postgres`. Seven have `search_path=public`; `rls_auto_enable` has `search_path=pg_catalog`.

| Function | Live binding and repository caller | Assessment / release dependency |
| --- | --- | --- |
| `handle_new_user()` | Trigger on `auth.users`; inserts profile and default `user` role. No application RPC caller found. | Trigger-only operation. Direct `anon` and `authenticated` EXECUTE is unnecessary to the documented flow; verify trigger execution after narrowing grants. |
| `has_role(user_id, role)` | Called by `is_admin()` and RLS policy chain. Accepts **any** user ID and returns whether that ID has a requested role. | Public RPC can disclose role membership for a supplied ID. Replace with a caller-bound private helper or restrict direct execution only after every RLS dependency is mapped and tested. Do not revoke blindly. |
| `is_admin()` | Referenced by 30 live RLS policies, including public reads and staff writes; calls `has_role(auth.uid(), 'admin')`. | Returns only the caller's admin status, but is an exposed privileged helper. Move to a non-exposed schema with coordinated policy replacement and allow/deny checks, rather than revoking EXECUTE in place. |
| `record_registration_payment()` | No live trigger binding found. Original migration attached it to `registrations`; live function remains but trigger is absent. No app RPC caller found. | Orphaned privileged trigger function. Confirm checkout migrations and historic use, then revoke/drop in a coordinated migration. |
| `register_prototype_ticket(ticket_type_id)` | No current app caller found. Body raises “refresh the page” exception; executable by `authenticated` only. | Legacy disabled checkout RPC. Confirm old-client sunset, then remove or narrow grant; do not restore it. |
| `reserve_free_ticket(ticket_type_id)` | No current app caller found. Body raises the same exception; executable by both roles. | Legacy disabled checkout RPC. Confirm old-client sunset, then remove or narrow grant. |
| `rls_auto_enable()` | Bound to `ensure_rls` event trigger; pins `search_path=pg_catalog`. No app RPC caller found. | Infrastructure-only trigger. Direct public execution should be removed after verifying table-creation behavior in a disposable database. |
| `subscribe_newsletter(email, first_name, last_name)` | Called by the public newsletter server function in `src/lib/public.functions.ts`; inserts/updates contacts. | Public execution is intentional for signup, but it is a privileged write endpoint. Review abuse controls and consent provenance: current conflict path sets `consent_at=now()` and status `subscribed`, including an existing contact. Preserve explicit opt-out semantics before hardening. |
| `touch_updated_at()` | Invoker trigger on nine tables; sets `new.updated_at=now()`. | Sole mutable-search-path warning. Body uses a built-in and has no SQL relation lookup; low immediate risk. Pin a safe search path in a reviewed migration and verify trigger updates. |

The live `pg_proc` ACL shows default/public execution for most functions; explicit role grants remain for `register_prototype_ticket` and `subscribe_newsletter`. `has_function_privilege` confirms the advisor's effective role access. The prior SQL file is not enough to infer current grants or bindings.

## Auth setting

The live advisor says leaked-password protection is disabled. Enable it in hosted Supabase Auth after checking project-plan availability and signup/password-reset behavior; rerun the advisor and exercise a controlled password-change test. This review did not alter Auth configuration.

## Safe remediation order

1. Create a migration plan and isolated database acceptance for public/anonymous, signed-in non-admin, Admin, trigger and server-role paths. Include checkout, public event reads, signup, and newsletter opt-in/opt-out.
2. Remove unnecessary direct execution from trigger-only and orphaned functions, and retire the two disabled legacy checkout RPCs after confirming no supported client needs them. Re-run the advisor.
3. Replace `has_role(user_id, role)` with caller-bound authorization and move RLS helpers out of the exposed schema as one coordinated policy migration. Verify all 30 current policy dependencies before releasing.
4. Review the public newsletter RPC's consent semantics and abuse controls with the contact-security owner. Keep legitimate signup available while preserving a prior opt-out.
5. Pin `touch_updated_at` search path, enable leaked-password protection when available, and rerun hosted security checks.

No permission change should be applied solely to silence an advisor warning. Supabase documents that definer functions run with owner privileges and that exposed-schema functions can be called via RPC; [function guidance](https://supabase.com/docs/guides/database/functions), [advisor rules](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable), and [password guidance](https://supabase.com/docs/guides/auth/passwords) inform this order.
