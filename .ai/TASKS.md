# Parallel task split

These are the initial backlogs, not claims of completed work. Do not start large feature work during workspace setup.

## Codex tasks (`codex-dev`)

- Event draft, private preview, publish, and unpublish workflow.
- Admin CMS usability for normal CometX staff.
- Event images and existing CometX assets.
- Contacts and members separation, linking, search, and export.
- Flexible event, ticket, member pricing, and capacity model.
- Newsletter signup and contact database integration.
- Stripe ready payment, invoice, and receipt structure without live payments.
- Apply the official brandbook to the current UI.
- Remove placeholder and demo content without inventing CometX facts.
- Fix build and runtime issues.

## Claude tasks (`claude-review`)

- Review Supabase schema and migration order.
- Review row level security and admin permissions.
- Review Auth and secret handling.
- Review contacts versus members data model.
- Review ticket and registration capacity integrity.
- Review Stripe and payment data model.
- Review environment variable exposure and deployment setup.
- Review maintainability and edge cases; identify blockers before merge.

## Workflow

1. Codex works only on `codex-dev`, makes small commits, runs build/typecheck/relevant tests, updates `.ai/HANDOFF.md`, pushes, and stops for review.
2. Claude works only on `claude-review`, fetches `codex-dev`, reviews its commit/diff against the intended base, writes prioritized findings to `.ai/REVIEW.md`, commits and pushes the review, and avoids broad unrelated rewrites.
3. Codex fetches `claude-review` and reads `.ai/REVIEW.md` from that branch, fixes BLOCKER and IMPORTANT findings on `codex-dev`, reruns checks, updates `.ai/HANDOFF.md`, and requests another review.
4. Merge into `main` only when review is clean. Never force push or rewrite published history.
