# schedule-gantt

## Objective
New `#gantt` page: a "typical day" 24 h Gantt, one row per scheduled artifact, bars at the scheduled times with width = average duration of the last N runs (N chosen by the user). Groupable by capacity and by workspace, to spot overlaps and load peaks.
Also tighten extraction: persist only artifacts that have at least one schedule; discard the rest.

## Scope / constraints
- Fabric facts (verified on MS Learn): `GET /workspaces/{ws}/items/{item}/jobs/instances` is paged, no `top`, no guaranteed order, ~100 recent completed runs max; `startTimeUtc`/`endTimeUtc` have no `Z` (UTC). `capacityId` is optional on `/workspaces` items (absent for personal/shared).
- Run history persisted at sync (token only exists in the function). Store last 20 runs per scheduled artifact; page picks N <= 20 client-side.
- Runs counted for the average: status Completed or Failed with both timestamps. Others ignored.
- Ceiling v1: times are drawn in each schedule's own local time (Windows tz ids, no IANA conversion); UI notes mixed time zones. Monthly schedules are listed but not drawn unless the picked day matches (kept simple: not drawn, flagged).
- Test-first: frontend gantt lib has vitest (RED -> GREEN). Functions package has no test runner: exception, checks = `npm run typecheck` + `npm run validate:functions`.
- Commits: conventional, no AI attribution (user rule). No push/PR without the user.
- Authorized edit surfaces: `packages/data/src/**`, `packages/shared/src/**`, `packages/functions/src/**`, `packages/frontend/src/**`, `README.md`, this file.

## Tasks
- [x] T1 Extraction: skip artifacts with 0 schedules, purge existing non-scheduled Artifact+Schedule rows, add `capacityId` (+ best-effort capacity name via `/capacities`) to Artifact, shared types, sync. Route: delegated writer (T1+T2 same files).
- [x] T2 JobRun: entity `JobRun` (data + shared + schema), `listItemJobInstances` in fabric-scan, persist last 20 per scheduled artifact (replace per artifact). Route: delegated writer.
- [x] T3 Gantt lib (pure, tested): occurrences for a chosen weekday from Cron/Daily/Weekly, average of last N runs, grouping by capacity/workspace, overlap/peak count. Route: delegated writer.
- [x] T4 Gantt UI: `#gantt` route (use-hash-route, app-shell nav + title, App.tsx), N selector, weekday selector, group-by toggle, load a JobRun query in App. Route: delegated writer.
- [x] T5 Cleanup/wording: drop redundant `schedulesOnly` filter, fix "schedulable artifact" wording, README. Route: delegated writer.

### Round 2 (user request: capacity name, capacity/workspace filters, better visuals/tooltip)
- Finding: `/capacities` only lists capacities where the principal is admin/contributor (MS Learn), and the sync swallows its failure silently -> names likely unresolved with the app identity.
- [x] T6 Capacity name: surface resolution failures (sync note counts unresolved capacities; clear UI label + hint when a name is unavailable), verify via Rayfin docs whether `update` with undefined clears a stored value and make capacityName/capacityId clearing explicit if needed. Route: delegated writer.
- [x] T7 Filters: capacity and workspace multi-select filters on the Gantt (applied before grouping, counts per option, clear-all), pure filter in lib/gantt with tests first. Route: delegated writer.
- [x] T8 Visuals: custom accessible tooltip (hover + keyboard focus) with artifact, workspace, capacity, item type, schedule, time range, avg duration, runs used, last run status; polish bars/load strip/headers per app-design. Route: delegated writer.

## Acceptance
- Sync stores no artifact without schedules; old ones are removed.
- Gantt shows bars for scheduled artifacts, width = avg of last N runs, N configurable, grouping by capacity and workspace, overlaps visible.
- typecheck, build, lint, test, validators green.

## Progress / evidence
- T1 done: commit efd2e17. typecheck, validate:functions, build, lint, test (72 passed) green. Route: delegated writer (no functions test runner: accepted exception).
- T2 done: commit 16d3c42. Same checks green. Job-run progress reuses stage `persist` (65-75%), so frontend sync-steps unchanged (its Reconcile detail still says "Hiding removed items"; T5 wording).
- Note: node_modules was missing; `npm install` run at root (no lockfile change).

- T3 done: commit 94c8f50. RED observed (spec failed: gantt module missing, 0 tests ran), GREEN 19 tests. Route: delegated writer.
- T4 done: commit 44c95dc. Job runs load lazily in a separate App effect (route === 'gantt' or after sync). Route: delegated writer.
- T5 done: commit ee05c6a. typecheck, build, lint, test (99 passed), validate:visual green. Not visually verified in a browser (auth-gated app).
- T6 done: commit c770778. Data client skips `undefined` on update (stored value survives) and sends `null` as GraphQL null (source: node_modules/@microsoft/rayfin-data/dist/graphql/GraphQLEntityClient.js formatMutationInput + formatValue.js; not stated in the docs), so capacity fields are nulled explicitly via a narrow cast. Sync records a note for unresolved capacities.
- T7 done: commit 3be2d7e. RED observed (10 new cases failed: filterArtifacts/filterOptions missing, filter UI absent), GREEN after implementation.
- T8 done: commit 7ab0b35. typecheck, validate:functions, build, lint, test (126 passed), validate:visual green. NOT verified in a browser (auth-gated).

## Next step
Visual check of the Gantt page; push/PR is the user's decision.
