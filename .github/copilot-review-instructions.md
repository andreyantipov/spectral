# Copilot Review Instructions

Automated review guidelines for GitHub Copilot (and human reviewers). Flag any violation as a blocking comment.

## Package Inventory

### core.contract.* (Level 0 — zero deps)
- `core.contract.event-bus` — EventBus contract (Context.Tag + type signatures)
- `core.contract.native` — Native API contract (Electrobun calls)
- `core.contract.storage` — Storage contract

### base.* (Level 1 — imports core.contract.* only)
- `base.error` — typed error classes
- `base.schema` — Model.Class (Effect Schema base)
- `base.tracing` — withTracing() wrapper
- `base.type` — shared type utilities

### ui.* (Level 2 — no imports from domain.*)
- `ui.base.components` — design tokens, Panda CSS, styled-system, presentational components (uses @styled-system/* path alias internally)
- `ui.base.api` — hooks, RuntimeProvider

### core.impl.* (infrastructure implementations — one Layer per package)
- `core.impl.db` — implements core.contract.storage (SQLite/Drizzle)
- `core.impl.event-bus` — EventBusLive (in-memory PubSub implementation of EventBus contract)
- `core.impl.ipc-bridge` — IpcBridgeLive (configurable IPC bridge for cross-process EventBus delivery, "main" | "webview")
- `core.impl.native` — implements core.contract.native (Electrobun native API calls)

### core.middleware.* (cross-cutting infrastructure)
- `core.middleware.otel` — OTLP exporter + service name constants (OtelLive, OTEL_SERVICE_NAMES)

### domain.feature.* (pure business logic — no EventBus, no lifecycle)
- `domain.feature.bookmark`
- `domain.feature.history`
- `domain.feature.layout`
- `domain.feature.omnibox`
- `domain.feature.session`
- `domain.feature.settings`

### domain.service.* (singleton orchestrators — subscribe to EventBus, have lifecycle)
- `domain.service.browsing`
- `domain.service.workspace`

### wire.desktop.*
- `wire.desktop.main` — Bun/Electron main process runtime
- `wire.desktop.ui` — Webview/renderer runtime

### ui.feature.* (UI-layer feature components)
- `ui.feature.keyboard-provider`
- `ui.feature.sidebar`
- `ui.feature.workspace`

### ui.scene.*
- `ui.scene.main` — top-level app scene

---

## Boundary Rules

### 1. Feature vs Service Boundary
- **Features** (`domain.feature.*`): pure business logic. Must NOT import from `core.contract.event-bus`, must NOT have lifecycle, must NOT be singletons. Must NOT use PubSub or Stream. Must NOT import `core.impl.*`. Only contracts and base utilities allowed.
- **Services** (`domain.service.*`): singleton orchestrators with lifecycle. Subscribe to EventBus, coordinate features.
- Flag: a `domain.feature.*` package that imports `core.contract.event-bus`, `core.impl.*`, or uses PubSub/Stream.

### 2. No @effect/rpc
- `@effect/rpc` is removed. Flag any import of `@effect/rpc` anywhere in the codebase.
- Cross-process communication uses `core.impl.ipc-bridge` (IpcBridgeLive, configured per side) only.

### 3. No Removed Packages
Flag any import of these deleted packages:
- `domain.adapter.carrier`
- `domain.adapter.electrobun`
- `domain.adapter.rpc`
- `domain.service.native`
- `core.port.carrier`
- `core.base.service-factory`
- `core.contract.otel`
- `core.impl.otel`

### 4. Core Level Isolation
- `core.contract.*` must have zero dependencies on any other `@ctrl/*` package.
- `base.*` may only import `core.contract.*`.
- `ui.*` must not import from `domain.*`.
- Flag any violation of these level rules.

### 5. One Layer Per Impl Package
- Each `core.impl.*` package must export exactly **one Layer**. If a package has multiple Layers, split it.
- Flag: a `core.impl.*` barrel (`index.ts`) that exports more than one symbol ending in `Live`.

### 6. No Direct Electrobun Calls Outside Impl
- Only `core.impl.native` and `core.impl.ipc-bridge` may reference Electrobun IPC handles directly.
- Flag any `electrobun` import in `domain.feature.*`, `domain.service.*`, `core.contract.*`, `base.*`, or `ui.*`.

### 7. No Re-exports
- Barrel re-exports are prohibited. Each package has a single `index.ts` that exports its own symbols only.
- Flag `export * from` or `export { ... } from` pointing to another `@ctrl/*` package.

---

## ast-grep Rules (enforced via `sg scan`)

The following rules live in `.ast-grep/rules/` and must all pass:

| Rule file | What it checks |
|-----------|---------------|
| `port-no-implementation.yml` | `core.contract.*` packages contain no implementation (only Context.Tag + types) |
| `electrobun-boundary.yml` | Electrobun imports only in `core.impl.native` and `core.impl.event-bus` |
| `no-effect-rpc.yml` | No imports of `@effect/rpc` anywhere |
| `layer-provide-boundary.yml` | Layer.provide only in wiring packages or service entry points |
| `feature-import-boundary.yml` | `domain.feature.*` does not import EventBus contract or impls; blocks deleted `core.base.service-factory` |
| `feature-no-reactive.yml` | `domain.feature.*` does not use PubSub or Stream.fromPubSub |
| `impl-single-layer.yml` | Documentation-only: reminds reviewers each `core.impl.*` must export one Layer (not machine-enforceable) |

Run: `bunx sg scan` — must report 0 violations before merge.

---

## Checklist for Architecture PRs

- [ ] Before/after dep-cruiser SVGs attached (`bun run docs:deps`)
- [ ] CLAUDE.md updated if packages added/removed/renamed
- [ ] `bun run check` passes (typecheck)
- [ ] `bun run test` passes
- [ ] `bunx grit check .` passes (0 violations)
- [ ] `bunx sg scan` passes (0 ast-grep violations)
- [ ] No `@effect/rpc` imports introduced
- [ ] No imports from deleted packages
- [ ] Feature/service boundary respected
