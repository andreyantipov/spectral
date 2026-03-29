# Copilot Code Review Instructions

Before reviewing, read these files for architectural context:

## Required context

- `CLAUDE.md` — project architecture rules, package boundaries, conventions
- `docs/architecture/GENERATED.md` — auto-generated package map, services, events, layer graph
- `.ast-grep/rules/*.yml` — structural linting rules enforcing architecture boundaries

## Architecture rules to enforce during review

### Package boundaries (hexagonal architecture)

- `core.*` cannot import `domain.*` or `ui.*`
- `domain.feature.*` cannot import `domain.service.*`, `domain.adapter.*`, or other `domain.feature.*`
- `domain.service.*` cannot import `domain.adapter.*` or other `domain.service.*`
- `ui.*` cannot import `domain.*` at all — UI communicates only through `core.ui.api` (EventBus)
- `core.ui.components` is pure presentational — no imports from `domain.*`, `core.ui.api`, or `core.port.*`

### Code conventions

- `type` only, never `interface` in `packages/libs/`
- No `Effect.withSpan()` — use `withTracing()` from `@ctrl/core.base.tracing`
- No `console.log` — use `console.error` or `console.warn`
- No re-exports from `@ctrl/*` packages in barrel files (`core.*`, `ui.*`)
- No relative `styled-system/` imports — use `@styled-system/*` alias
- Style declarations (`sva`/`cva`/`css`) must be in `.style.ts` files, not `.tsx`
- No `cva` in `core.ui.components` — use `sva` only

### Effect patterns

- Domain layers (`Layer.succeed`, `Layer.effect`) must use `withTracing()`
- No raw `async/await` in bun layer — use `Effect.gen`
- `Model.Class` (Effect Schema) is the single source of truth for domain types

### Hexagonal architecture (ports & adapters)

Review critically for these violations:
- **Adapter without a port** — every `domain.adapter.*` must implement a corresponding `core.port.*` interface. If a new adapter appears without a port, flag it.
- **Logic in ports** — `core.port.*` packages must contain ONLY `Context.Tag` declarations and type signatures. No business logic, no Effect pipelines, no implementations. If a port file has `Effect.gen`, `Layer.effect`, or any logic beyond type definitions — reject.
- **Port implementing itself** — ports must not contain `*Live` layers or any implementation code. That belongs in adapters.
- **Adapter bypassing its port** — adapters must not be imported directly by features or services. They should only be wired in runtime layers (`domain.runtime.*`).
- **Fat ports** — a port should represent ONE concern. If a port has 10+ methods or mixes unrelated operations, suggest splitting.
- **Direct external dependencies in features** — features must depend on ports, not on external libraries directly. If `domain.feature.*` imports `drizzle`, `@libsql`, or `@opentelemetry` — flag it.

### Naming

- Browsing unit of work is a **session**, not tab
- UI scene packages: `ui.scene.*` (not `ui.scenes`)
- Package naming follows FSD: `{layer}.{slice}` pattern
