# Back Office latency investigation — 2026-10-19

Branch: `codex/benefit-catalog-release-20261017`.
Diagnostic code: `7cd5e4d`; no speed optimization in this release.

## Release

Pushed the existing diagnostic commit after checking remote HEAD was `e584e20`.
Vercel Preview build passed. Redeployed the same source with Production settings:
`GspTzEbbf7goxfdPYRqZNmCrWqKH`, Ready, assigned to `cometx-prototype.vercel.app`.
The selected production runtime request confirms this deployment ID.
No migrations, permission changes, member edits, or payment operations.

## Measurements

Authenticated Members full reload to first visible View details button, measured with
wall-clock time around browser reload and locator visibility. Includes browser/tool
observation overhead; browser and infrastructure caches were not forcibly cleared.
These are not guaranteed cold-start measurements or a controlled before/after test.

- Previous session before diagnostic release: 1730, 1857, 1719 ms.
- After diagnostic release: 2527, 1957, 1836 ms.
- Earlier recorded 8.92-second server invocation was not reproduced in these samples.

Production Members stage logs on 19 October, Europe/Bratislava:

| Request time | Authorization | Profiles | Related membership/role reads | Total stages |
| --- | ---: | ---: | ---: | ---: |
| 09:22:31.77 | 423 ms | 310 ms | 349 ms | 1082 ms |
| 09:22:34.28 | 426 ms | 355 ms | 356 ms | 1137 ms |

Selected first request: HTTP 200, function execution 1.08s, response 1.2s.
Received in Frankfurt (fra1), function routed to Washington, D.C. (iad1).
External calls listed Auth user, staff roles, profiles, memberships and member roles.
No credentials or member data are included in the diagnostic log payload.

## Conclusions and next step

The trace now works in Production. These samples show distributed remote-read cost,
not one dominant query, and do not explain the earlier intermittent 8.92s invocation.
Region mismatch is a lead, not a proven root cause: verify the actual Supabase region
before changing Vercel placement. Capture a slow request with its stage logs to
separate remote authorization/database delays from startup time outside the handler.
Keep live authorization checks; do not widen caching or bypass guards to improve timings.
Existing trace only logs successful paths exceeding one second, and groups the two
related reads. Missing logs do not establish that every request is fast.

## 2026-10-19 follow-up: region alignment prepared, verification blocked

Supabase project `vlcssswzlvamtscyobbv` reports primary region `eu-west-1`
(Ireland). The selected Vercel Production Members invocation executed in `iad1`
(Washington, D.C.) after receipt in `fra1`. Vercel documents `dub1` as Dublin,
Ireland, and recommends placing functions in the same region as the database.

Commit `65e7e6f` adds `"regions": ["dub1"]` to `vercel.json` and was pushed to
`codex/benefit-catalog-release-20261017`. JSON validation and `git diff --check`
passed. The connected browser was disabled immediately after push, before the new
Preview build or a Production redeployment could be inspected. This commit is not
yet verified as running in Production. The current Production deployment remains
`GspTzEbbf7goxfdPYRqZNmCrWqKH` from `7cd5e4d` unless another actor changed it.

Exact next: inspect the build of `65e7e6f`, redeploy that source with Production
settings, confirm a Members request executes in `dub1`, then compare several
signed-in cold/warm loads and the stage logs. Do not claim a speedup from the
configuration change alone. If `dub1` is unavailable for the plan, use the
nearest supported European region after checking the deployment settings.
