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
