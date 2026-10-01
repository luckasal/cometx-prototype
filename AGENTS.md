<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## CometX multi-thread workflow

Every Codex thread must, before editing, read this file plus `.ai/CONTEXT.md`, `.ai/TASKS.md`, and `.ai/HANDOFF.md`; read `.ai/REVIEW.md` when reviewing or resolving findings. Inspect `git status --short --branch` and recent commits (`git log -5 --oneline`).

- Claim one task and its owner/branch in `.ai/TASKS.md` before implementation. Work only on that task; stop if ownership or scope overlaps another active thread.
- Use a separate Git worktree/branch per concurrent thread. A branch is not an isolation boundary when threads share one checkout. Do not edit, stage, revert, or overwrite another thread's unfinished work; coordinate first if the worktree is dirty.
- Thread A focuses on UI/frontend; Thread B on backend/Supabase/Stripe; Thread C on QA/review/security. These are suggested roles, not permission to change unrelated code.
- Keep changes small and focused. Never work directly on `main`, force-push, or rewrite published history. Integrate reviewed work by ordinary commits/merges only.
- After a task, run the smallest relevant checks; update its status and blockers/decisions in `.ai/TASKS.md`; append a `.ai/HANDOFF.md` entry with task, files, commit hash, checks, known issues, and exact next task; commit only your files and stop. If the handoff needs the final commit hash, make a separate handoff commit referencing the implementation commit.
- Thread C records findings in `.ai/REVIEW.md` as BLOCKER, IMPORTANT, or NICE TO HAVE. Do not merge to `main` while BLOCKER or IMPORTANT findings remain.

## Project guardrails

- Supabase PostgreSQL and Auth are the source of truth. Normal CometX staff manage content through `/admin`.
- Contacts are leads/subscribers; members are authenticated users with memberships. Keep these records separate and link them explicitly.
- Preserve authentication, memberships, events, registrations, account, and admin flows when changing the site.
- Use verified CometX content and brand assets. Never invent people, prices, membership benefits, event details, or claims.
- Keep secrets in ignored local files or server environment variables; never expose service keys or other secrets to browser code.
- Production deployment and database migration are separate, coordinated release steps; a branch push does not imply a production release.
