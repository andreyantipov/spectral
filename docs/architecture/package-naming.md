# Package Naming Convention

All packages live in `packages/libs/`. Three namespaces, alphabetically sorted to reflect dependency direction.

## Three Namespaces

```
c  core.*           Foundation — schemas, ports, UI toolkit (2-level)
d  domain.*.*       Business logic — adapters, features, services (3-level)
u  ui.*.*           Presentation — feature widgets, composed pages (3-level)
```

**Alphabetical order = dependency direction: `c → d → u`**

`core.*` packages are the only dependency of `domain.*.*`. `domain.*.*` are the only dependency of `ui.*.*`. Never the reverse.

## Domain Tiers (`a → f → s`)

The second level of `domain.*.*` encodes the hexagonal layer:

| Tier | Package format | Hex role | Depends on |
|------|---------------|----------|------------|
| adapter | `domain.adapter.<name>` | Driven adapter (implements ports) | `core.shared` |
| feature | `domain.feature.<name>` | Atomic domain logic (single concern) | `core.shared` via DI |
| service | `domain.service.<name>` | Application service (composes features) | `domain.feature.*` + `core.shared` |

Alphabetical `a → f → s` matches dependency direction within `domain`.

### Special adapter: `domain.adapter.rpc`

`domain.adapter.rpc` is a **generic Electrobun IPC tunnel** — it has no knowledge of sessions, browsing, or any other domain concept. It exports `ElectrobunServerProtocol` (Bun/main-process side) and `ElectrobunClientProtocol` (webview side), each implementing the corresponding `@effect/rpc` protocol interface. The domain contract (`BrowsingRpcs`) lives in `domain.service.browsing` and is separate from the transport layer.

## UI Tiers (`f → s`)

The second level of `ui.*.*` encodes the presentation layer:

| Tier | Package format | Role | Depends on |
|------|---------------|------|------------|
| feature | `ui.feature.<name>` | Wires a domain service to a component | `domain.service.*` + `core.ui` |
| scenes | `ui.scenes` | Single package containing all scene compositions | `ui.feature.*` + `core.ui` |

Scenes are thin compositions (~20 lines each) and don't need package isolation. All scenes live in a single `ui.scenes` package. Alphabetical `f → s` matches dependency direction within `ui`.

## Core Packages (always 2-level)

| Package | Purpose |
|---------|---------|
| `core.shared` | Ports (`Context.Tag`), domain types, shared errors, `withTracing`, `spanName` |
| `core.ui` | Component toolkit (atoms → molecules → organisms → templates) + `useStream`/`useService`/`useDomainService` |

`core.shared` and `core.ui` have no dependency on each other.

## Two Public Surfaces

Only two tiers are importable from outside their own namespace:

- **`domain.service.*`** — the public API of all business logic (imported by `ui.feature.*`)
- **`ui.scenes`** — the public API of all UI (imported by `packages/apps/*`)

Everything else is internal. GritQL enforces this — see `docs/architecture/dependency-matrix.md`.

## Naming New Packages

1. Pick the correct namespace based on what the package does (foundation → core, business logic → domain, presentation → ui).
2. Pick the correct tier within that namespace.
3. Use a short, lowercase noun for the third level: `session`, `bookmark`, `sidebar`, `main`. Note: the browsing unit of work is called a **session** (not tab) — `domain.feature.session` not `domain.feature.tab`.
4. The resulting name is both the directory name and the npm package name: `@ctrl/<namespace>.<tier>.<name>`.

Examples:
- A new DB-backed repository for bookmarks → `domain.adapter.bookmark` → `@ctrl/domain.adapter.bookmark`
- Atomic business logic for bookmarks → `domain.feature.bookmark` → `@ctrl/domain.feature.bookmark`
- A new page composed from features → add it to `ui.scenes` → `@ctrl/ui.scenes`

For deep details see `docs/superpowers/specs/2026-03-14-domain-architecture-design.md` (Sections 2–3).
