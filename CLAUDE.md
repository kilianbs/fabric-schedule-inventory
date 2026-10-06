# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` is the authoritative project instruction file (capability routing, pack workflow, deployment rules). Read it and the relevant `.agents/skills/*/SKILL.md` before changing the app; this file only summarizes the big picture.

## What this app is

A Microsoft Fabric App (Rayfin, React + Vite) that inventories scheduled Fabric items. A server-side function scans every workspace the app identity can access, keeps only item types that can carry schedules, and persists artifacts and their schedules as app-owned records. The frontend shows the inventory and sync progress.

## Commands (run from the workspace root)

- `npm run dev` — Rayfin local services plus the frontend dev server (`dev:frontend` for Vite only, port 5173)
- `npm run typecheck` — builds shared + functions, then `tsc -b`. **The frontend build uses `tsc -b --noCheck`, so `build` does not prove type safety; always run typecheck separately.** Never run typecheck and build concurrently (shared TS outputs).
- `npm run build` / `npm run build:fabric` — builds shared, validates and builds functions, builds data, then the frontend
- `npm run lint` — ESLint on the frontend only
- `npm test` — Vitest (frontend only). Single file: `npm run -w @rayfin-app/frontend test -- src/lib/to-data-table.spec.ts`; by name: add `-t "<name>"`
- `npm run validate:visual` — visuals-pack validator; `npm run validate:functions` — functions validator
- `npm run pack:add -- <pack>` — apply one capability pack at a time, serially (installed packs: data-modeling, functions, visuals)
- `npm run rayfin:up` — provisions Fabric resources (a remote write; see the `app-deployment` skill and confirm the target workspace first)

Final validation order per AGENTS.md: typecheck → build → lint → test → pack validators → browser validation.

## Architecture

npm workspaces with stable package names; service wiring lives in `rayfin/rayfin.yml`.

- `packages/shared` (`@rayfin-app/shared`) — browser-safe contracts: `UniversalAppSchema` and record types such as `SyncRunRecord`. Must build before the others consume it.
- `packages/data` (`@rayfin-app/data`) — decorated entity classes `Artifact`, `Schedule`, `SyncRun`, registered in the `schema` array in `src/index.ts`. Every entity needs explicit access control. When adding an entity, keep `UniversalAppSchema` in shared in step with `schema`, otherwise `client.data.<Entity>` is untyped. The frontend must not import these decorated classes; use `@rayfin-app/shared`.
- `packages/functions` (`@rayfin-app/functions`) — Fabric user data functions. `function_app.ts` holds `syncInventory`; `fabric-scan.ts` holds the paginated Fabric REST helpers (`listAll`, `listItemSchedules`, `mapWithConcurrency`) and the `SCHEDULABLE_ITEM_TYPES` list. The Fabric scan runs under the app identity token (`ctx.Tokens.Fabric`), while persistence uses the caller's Rayfin data client. `secrets.generated.ts` is generated; don't hand-edit. `types.ts` exports `AppFunctionsSchema` used to type the client.
- `packages/frontend` (`@rayfin-app/frontend`) — React + Vite + Tailwind v4 (tokens in `src/global.css`, `@/` alias for frontend-only imports). Hash-based routing (`hooks/use-hash-route.ts`), no router library.

### Sync flow (spans function, data, and frontend)

1. Frontend `hooks/use-sync.ts` invokes the `syncInventory` function via `client.functions`.
2. The function creates a `SyncRun` row (`status: running`) and updates `stage`/`progressPercent`/workspace counters as it goes (throttled, failures swallowed), then finalizes it as completed or failed with a capped error list.
3. While running, the frontend polls the latest `SyncRun` row every 1.5 s; a `running` row older than 15 min is treated as dead. On finish it refreshes entity queries.
4. Display components (`inventory-view`, `inventory-summary`, `schedule-detail`, `sync-progress`) read `Artifact`/`Schedule` via `lib/rayfin-client.ts` and helpers like `lib/inventory-totals.ts`, `lib/to-data-table.ts`, `lib/sync-steps.ts`.

### Auth and client

- `getRayfinClient()` (`lib/rayfin-client.ts`) is async and resolves deployment config at runtime (so one built artifact can be promoted Dev→Prod); it is typed with `UniversalAppSchema` and `AppFunctionsSchema`. Use it for all service operations.
- Keep the auth bootstrap, provider, `AuthGate`, `assetAccess: protected`, and disabled password auth intact. No app content may render before authentication. Local dev signs in via the Rayfin CLI session.
- Don't use module memory, localStorage, or sessionStorage as the database. Never invent query columns; inspect returned schemas.

## Conventions worth knowing

- Install from the root only; no nested lockfiles or nested `npm install`.
- Do not change dependency versions pinned by the template or packs.
- Read `.agents/skills/app-design/SKILL.md` before UI changes; for Rayfin API/CLI questions prefer the installed docs under `node_modules/@microsoft/*` (`rayfinDocs`) over memory.
- Never deploy or add `--force` without explicit user confirmation of the target workspace.
