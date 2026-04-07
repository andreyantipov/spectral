# Architecture Rules

## Package Naming
- See `docs/architecture/package-naming.md`
- FSD segments: `docs/architecture/fsd-segments.md`
- Dependencies: `docs/architecture/dependency-matrix.md`

## Key Architectural Rules

### Type System
- `type` only, never `interface` in packages/libs/
- **`Model.Class`** (extending Effect Schema) is the single source of truth for domain types

### Tracing
- No `Effect.withSpan()` — use `withTracing()` from `@ctrl/base.tracing`
- No hardcoded strings for span names or service identifiers

### Service Architecture
Three services handle all EventBus commands:
- **`WebBrowsingServiceLive`** — handles `session.*`, `nav.*`, `bm.*` → publishes `browsing.snapshot`
- **`WorkspaceServiceLive`** — handles `ws.*` → publishes `workspace.snapshot`
- **`SystemServiceLive`** — handles `state.*`, `diag.*`, `ui.*`, `settings.*`

Services communicate via **event choreography**: one service dispatches EventBus commands that another handles.

### One Layer Per Impl Package
Each `core.impl.*` package exports exactly **one Layer**. See `.ast-grep/rules/impl-single-layer.yml`.

### Feature vs Service Boundary
- **Features** (`domain.feature.*`) = pure business logic, no EventBus/PubSub/Stream
- **Services** (`domain.service.*`) = singleton orchestrators with lifecycle

### Package Levels

```
Level 0: core.contract.*     → pure interfaces (Context.Tag + signatures)
Level 1: base.*              → schemas, errors, utilities
Level 2: core.impl.*         → adapter implementations
Level 3: ui.base.*           → components, hooks, RuntimeProvider
```

### EventBus + IPC Bridge
- **EventBus** = ALL business communication
- **IPC Bridge** = transparent cross-process delivery
- Business code never touches IPC directly

## AST-Grep Rules
Architecture boundaries enforced by ast-grep:
```bash
ast-grep scan  # Check violations
```

## Dead Code & Dependencies
```bash
bun run lint:dead-code  # knip check
bun run lint:deps       # sherif check
```