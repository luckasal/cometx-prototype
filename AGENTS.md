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

## CometX agent workflow

Before every task, read `.ai/CONTEXT.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md`, and `.ai/REVIEW.md`.

- Codex is the primary implementer on `codex-dev`; Claude reviews architecture and security on `claude-review`.
- Supabase PostgreSQL and Auth are the source of truth. Normal CometX staff manage content through `/admin`.
- Contacts are leads/subscribers; members are authenticated users with memberships. Keep these records separate and link them explicitly.
- Preserve authentication, memberships, events, registrations, account, and admin flows when changing the site.
- Use verified CometX content and brand assets. Never invent people, prices, membership benefits, event details, or claims.
- Keep secrets in ignored local files or server environment variables; never expose service keys or other secrets to browser code.
- Make small commits. Do not modify `main` directly. Merge only after review has no blockers or important findings.
- Codex builds, typechecks, tests relevant flows, updates `.ai/HANDOFF.md`, commits and pushes, then stops for review. Claude reviews the Codex diff, records findings in `.ai/REVIEW.md`, and avoids unrelated rewrites.
