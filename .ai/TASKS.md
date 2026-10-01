# CometX task board

One active owner per task. Before editing, record a task ID, owner/thread, branch/worktree, scope, status, and dependency. Use `unassigned`, `in progress`, `blocked`, `review`, or `done`. A suggested role is not an assignment.

| ID | Task | Owner / branch | Status | Decision or blocker |
| --- | --- | --- | --- | --- |
| EVENT-ADMIN-2A | Event list search/filters/metrics/actions and event Overview tab | Codex / `codex/event-admin-phase-2a` | done | Implemented and typechecked. Other event tabs and excluded features remain for later phases. |
| EVENT-OPS-2B | Event-scoped attendee roster, check-in and export | Codex / `codex/event-ops` | done | UI/server/migration implemented and focused checks pass. Migration `0010` remains unapplied and must follow pending `0007`–`0009`; runtime check-in awaits coordinated sandbox verification. |
| AUTH-REDIRECT-01 | Preserve requested local admin destination after successful login | Codex / `codex/event-ops` | done | Use TanStack client-side navigation after password sign-in so AuthProvider state remains available to protected routes; retain `safeReturnPath` validation. |
| AUTH-LOCAL-02 | Restore local account session verification against Supabase | Codex / `codex/event-ops` | done | Browser auth state was valid; sandboxed Vite server could not reach Supabase Auth and returned the same message as an absent session. Restarted local server with outbound access and verified account/staff view; no app or database changes. |
| SETUP-01 | Multi-Codex-thread repository instructions and handoff templates | setup thread / `codex-dev` | done | Documentation only; existing unfinished code preserved. |
| EVENT-READ-01 | Verify and finish legacy event-capacity read compatibility | unassigned; current change in `cometx-codex` | in progress | `src/lib/events.functions.ts` is dirty; claim ownership before touching it. Do not deploy all of `codex-dev` without schema/release review. |
| RELEASE-01 | Plan coordinated migrations `0007`–`0009` and checkout release | unassigned | blocked | Requires schema/security review and sandbox payment verification. |

## Suggested role lanes

- **Thread A — UI/frontend:** event and cart presentation, responsive behavior, accessibility. Claim a concrete task and avoid backend/schema changes unless agreed.
- **Thread B — backend/Supabase/Stripe:** server reads, migrations, RLS, auth and payment logic. Use test mode and coordinate hosted writes.
- **Thread C — QA/review/security:** reproduce issues, review diffs and migration/deployment risk, record findings in `REVIEW.md`; do not rewrite unrelated code.

## Handoff sequence

1. Start from an independent worktree/branch; read the required context, check status and recent commits, then claim a narrowly scoped task here.
2. Implement only owned work. Communicate dependencies or overlapping files before either thread edits them.
3. Run minimal relevant checks. Set task status to `review`, `blocked`, or `done`, recording decisions and blockers.
4. Commit only owned files, append a handoff entry with the implementation commit hash, and commit that handoff. Stop for review/next assignment. Do not merge to `main` with BLOCKER or IMPORTANT findings.

Historical backlog and implementation notes remain in Git history and `.ai/HANDOFF.md`; do not infer that an old item is complete without checking code and the target environment.
