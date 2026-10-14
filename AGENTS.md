# Agent Instructions

## Purpose

This repository is **Fabric Schedule Inventory**, a React and Vite Fabric App built with Project Rayfin.
It scans every Fabric workspace the app identity can access, stores the items that have at least one schedule, and shows them as an inventory table and a 24-hour Gantt timeline.
Extend it without breaking the protected default and dynamic authentication flow, and validate the result users will actually run.
See [`README.md`](README.md) for the user-facing description of each page.

## How the app works

- **Data model** (`packages/data`, contracts in `packages/shared`): `Artifact` (a scheduled Fabric item with its workspace and capacity), `Schedule` (one Fabric schedule of an artifact), `JobRun` (the last finished runs of an artifact) and `SyncRun` (one sync with its stage, progress and capped error summary).
- **Sync** (`packages/functions/src/function_app.ts`, `syncInventory`): lists workspaces, items, schedules and job runs through the Fabric REST helpers in `fabric-scan.ts` using the app identity token (`ctx.Tokens.Fabric`), then persists through the caller's Rayfin data client. Only item types in `SCHEDULABLE_ITEM_TYPES` are probed; artifacts without schedules are not stored and previously stored ones are removed, except in workspaces that failed to scan.
- **Frontend** (`packages/frontend`): hash routes `#/` (inventory), `#/gantt` and `#/about` from `hooks/use-hash-route.ts`. `hooks/use-sync.ts` invokes the function and polls the latest `SyncRun` while it runs.

Invariants to keep:

- The Fabric token only exists inside the function, so anything that needs the Fabric API (job runs, capacity names) is read at sync time and stored, never fetched from the browser.
- Store at most `MAX_JOB_RUNS_PER_ITEM` (20) runs per artifact; the Gantt picks its *N* client-side.
- Capacity names come from `GET /capacities`, which only answers for capacities where the app identity is Admin or Contributor. Unresolved names fall back to a shortened id and a sync note; never invent a name.
- Schedule times are shown in each schedule's own time zone. Mixed zones are flagged, not converted.
- Gantt filters live in component state only, not in the URL or storage.

## Start with the source and capability

The installed packs are `data-modeling`, `functions` and `visuals` (see `rayfinPacks` in `package.json`).
Before adding a new capability, read the [`capability-router`](.agents/skills/capability-router/SKILL.md).
It owns source selection and the capability decision.

| Need | Apply, one command at a time | Seed or implementation anchor | Owning skill |
| --- | --- | --- | --- |
| Existing Power BI semantic model | `npm run pack:add -- connectors`, then `npm run pack:add -- analytics`; add `npm run pack:add -- visuals` separately if the app charts it | `packages/frontend/src/lib/connectors.ts`, `packages/frontend/src/hooks/use-semantic-model-query.ts`, `packages/frontend/src/queries/` | [`analytics`](.agents/skills/analytics/SKILL.md) |
| App-owned records | `npm run pack:add -- data-modeling` | `packages/data/src/Item.ts`, `packages/data/src/index.ts`, `packages/shared/src/index.ts` | [`data-modeling`](.agents/skills/data-modeling/SKILL.md) |
| Existing warehouse, SQL database, or Lakehouse SQL endpoint | `npm run pack:add -- connectors` | `rayfin/rayfin.yml`, `rayfin/connectors/<alias>/` | [`connectors`](.agents/skills/connectors/SKILL.md) |
| Charts or grids over sample data or app-owned records | `npm run pack:add -- visuals` | the visuals kit and typed visual specifications | [`visuals`](.agents/skills/visuals/SKILL.md) |
| Trusted action, external API, custom model endpoint, or Fabric data agent | `npm run pack:add -- functions` | `packages/functions/src/function_app.ts` | [`functions-capability`](.agents/skills/functions-capability/SKILL.md) |
| Static CSV or spreadsheet supplied for bundling | no pack; emit reviewed rows as typed application data | a typed module in the owning workspace package | [`capability-router`](.agents/skills/capability-router/SKILL.md) |
| Kusto or KQL source | unavailable in this release | none | [`connectors`](.agents/skills/connectors/SKILL.md) |

Capabilities compose.
Apply every selected pack with a separate command, serially, because pack operations mutate workspace manifests and root orchestration.
The scaffolder accepts one pack per invocation; do not invent a multi-pack command.

## Preserve the user's data intent

- Use a source the user confirmed.
- When the user supplies a URL or identifiers, extract and verify those values with the installed tooling before using them.
- Never fabricate a workspace ID, item ID, alias, schema, query result, or business value.
- If a named source is missing or several matches remain, ask the specific question needed to resolve it.
- If no source was named, search when a relevant catalog tool is available, then ask whether to connect a source or use sample data if the result is still ambiguous.
- Use sample data only when the user requested or confirmed a mock-up, and label it visibly in the UI.
- A semantic-model app requires the intended semantic model.
  Do not silently recover with invented rows or another model.

Legitimate uncertainty is a reason for a focused question, not a reason to guess.

## Read version-matched Rayfin guidance

Installed package documentation is authoritative for Rayfin APIs and CLI behavior.
Template skills own only this template's packs, files, kits, and workflow.

1. Read `node_modules/@microsoft/<package>/package.json`.
2. If it declares `rayfinDocs`, follow `rayfinDocs.dir`, read its `index.md`, and open only the page needed for the task.
3. For CLI and deployment questions, use the installed `@microsoft/rayfin-guide` documentation because `@microsoft/rayfin-cli` has no docs root of its own.

Use `rayfin docs search '<topic>'` or the installed docs search tool only when the indexes do not identify a page.
Use package discovery only when the needed package is not installed.
If the installed docs do not answer the question, say so rather than relying on memory.

Batch independent skill, seed, package metadata, and documentation reads.
Do not traverse every skill or reference directory up front.

## Workspace layout

The app has one npm workspace root and stable package ownership:

```text
package.json                         # Root commands, workspaces, and applied packs
rayfin/rayfin.yml                    # Fabric services and package paths
packages/frontend/                   # @rayfin-app/frontend, React and Vite
packages/data/                       # @rayfin-app/data, decorated runtime entities
packages/shared/                     # @rayfin-app/shared, browser-safe contracts
packages/functions/                  # @rayfin-app/functions, syncInventory and Fabric REST helpers
scripts/                             # Pack scaffolder and pack validators
```

When adding an entity, register it in the `schema` array of `packages/data/src/index.ts` and add its record contract to `UniversalAppSchema` in `packages/shared`; otherwise `client.data.<Entity>` is untyped.
`packages/functions/src/secrets.generated.ts` is generated; do not edit it by hand.

Run the normal `npm run dev`, `build`, `typecheck`, `lint`, `test`, and `pack:add` commands from the workspace root.
Let each pack's `packageJson` declaration place dependencies in the owning workspace manifest.
Install from the workspace root and do not create nested lockfiles or run nested package installs.
Use `@/` only inside the frontend package.
Use `@rayfin-app/shared` for isomorphic contracts instead of importing decorated data classes into the browser.

## Author in coherent layers

1. Settle the source and capability choices far enough to avoid building against the wrong contract.
2. Apply the selected packs serially before customizing files they seed.
3. Read each selected pack's owning skill, relevant seed files, and exact installed documentation.
4. Establish a runnable shell early in `packages/frontend`: title, layout, navigation, final content regions, and honest loading states.
   Source discovery and query authoring may continue independently while the shell is taking shape.
5. Before rendering source-backed values, run the real query or operation and use its verified result shape.
6. Integrate live data, interactions, saved-record behavior, and polish in cohesive changes.

Do not leave permanent authentication, permission, configuration, or query failures behind a loading state.
Retry only a documented transient condition, bound the attempts, and surface an actionable error when it does not recover.
Never substitute sample values while waiting for a real source.

Delegate substantial independent work only when it has a clear interface and enough scope to justify another context.
For a small app or a tightly coupled component flow, keep the implementation cohesive instead of fanning it out unconditionally.
Do not run manifest writers, pack applications, installers, or TypeScript builds that share output concurrently.

## Capability pack safety

`npm run pack:add -- <pack>` installs pinned dependencies from the workspace root, copies seeds into their owning packages, wires root scripts, and enables required services.
Apply packs before editing their destination files because existing files are preserved.

If a pack reports a preserved file, stop and report which file was not installed.
Use `--force-seeds` only when the user explicitly approves discarding the existing file.
Do not change a dependency version already pinned by the template or a pack.

On failure, pack-owned file changes are rolled back unless another writer changed them.
Reconcile reported rollback conflicts and follow [failure recovery](scripts/pack-manifest.md#failure-recovery) before retrying or continuing.
Do not assume `node_modules` or installer-written lockfiles were restored.

## Project conventions

- Use Tailwind v4 design tokens from `packages/frontend/src/global.css`.
- Support sign-in inside and outside the Fabric portal without rendering app content before authentication.
- Keep `assetAccess: protected`, the auth bootstrap, provider, and `AuthGate` intact.
  Local development uses CLI-backed sign-in; standalone browsers can use interactive Microsoft sign-in.
- Use `await getRayfinClient()` for service operations and surface configuration or permission failures explicitly.
- Preserve connector and backend authorization and keep password authentication disabled.
- Do not use module memory, local storage, or session storage as the database.
- Do not guess query columns.
  Inspect the returned schema before consuming it.
- Read [`app-design`](.agents/skills/app-design/SKILL.md) before creating or changing the UI.

<!-- BEGIN RAYFIN COPILOT PLUGIN -->
## Plugin compatibility invariants

The active plugin routes builders into this project, then the installed project skills, package docs, and CLI own the work.
Do not depend on retired plugin-specific build, validation, or deployment tools.

- **You own the toolchain.**
  Use the project-installed commands to restore dependencies, apply packs, invoke connectors, run typecheck, build, lint, tests, and pack validators, and follow the installed CLI deployment guide.
- Keep Fabric authentication enabled and keep password authentication disabled.
  Hosted assets are protected by default, and the app remains gated on an authenticated session even if an owner explicitly chooses public assets.
- **Talk about the app, not the machinery.**
  In user-facing updates, lead with what the app does and the result; mention commands, file paths, capabilities, and platform internals only when the user asks or needs them to understand a blocker.
<!-- END RAYFIN COPILOT PLUGIN -->

## Efficient validation cadence

During implementation, run the smallest targeted check that covers the behavior being changed, for example `npm run -w @rayfin-app/frontend test -- src/lib/gantt.spec.ts`.
Frontend logic lives in `packages/frontend/src/lib` with a `*.spec.ts` next to each module; add or update the spec with the behavior.
The functions package has no test runner; its checks are `npm run typecheck` and `npm run validate:functions`.
Do not rerun the full campaign after every edit.

At completion, run the applicable final sequence once, serially:

1. `npm run typecheck`
2. `npm run build`
3. `npm run lint`
4. `npm test`
5. Pack-provided validators such as `npm run validate:visual`
6. Browser validation from [`app-validation`](.agents/skills/app-validation/SKILL.md)
7. Persistence create, reload, update, and delete checks when the app owns records

The frontend build uses `tsc -b --noCheck` for speed and does not prove type safety.
Keep the separate root typecheck gate.
Do not race typecheck and build because the referenced workspace projects share TypeScript build outputs.
If a gate fails, fix the cause and rerun that gate plus any later gate whose result it invalidated, not every earlier success.

## Deployment

Read [`app-deployment`](.agents/skills/app-deployment/SKILL.md) before any remote write.
Follow the installed, version-matched Rayfin CLI guide, preview the operation, and deploy only after the user confirms the target workspace.
Never publish automatically or add `--force` on the user's behalf.
