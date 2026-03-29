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

## UI Tiers (`a → f → s`)

The second level of `ui.*.*` encodes the presentation layer:

| Tier | Package format | Role | Depends on |
|------|---------------|------|------------|
| adapter | `ui.adapter.<name>` | Driven adapter (platform integration, e.g. Electrobun) | `core.shared` + external |
| feature | `ui.feature.<name>` | Wires a domain service to a component | `domain.service.*` + `core.ui` + `core.shared` |
| scene | `ui.scene.<name>` | Scene composition package per concern | `ui.feature.*` + `ui.adapter.*` + `core.ui.components` |

Scenes are thin compositions (~20 lines each). Each scene gets a `ui.scene.<name>` package (e.g. `ui.scene.browser`).

## Core Packages (always 2-level)

| Package | Purpose |
|---------|---------|
| `core.shared` | Ports (`Context.Tag`), domain types, shared errors, `withTracing`, `spanName` |
| `core.ui.design` | CSS tokens, Panda config, styled-system output |
| `core.ui.components` | Component toolkit (atoms, molecules, organisms, templates) |
| `core.ui.api` | Hooks (`useApi`, `useRuntime`, `RuntimeProvider`, `useStream`, `useService`) |

`core.shared`, `core.ui.design`, `core.ui.components`, and `core.ui.api` have no circular dependencies.

## Two Public Surfaces

Only two tiers are importable from outside their own namespace:

- **`domain.service.*`** — the public API of all business logic (imported by `ui.feature.*`)
- **`ui.scene.*`** — the public API of all UI (imported by `packages/apps/*`)

Everything else is internal. ast-grep enforces this — see `.ast-grep/rules/domain-boundary-rules.yml`.

## Naming New Packages

1. Pick the correct namespace based on what the package does (foundation → core, business logic → domain, presentation → ui).
2. Pick the correct tier within that namespace.
3. Use a short, lowercase noun for the third level: `session`, `bookmark`, `sidebar`, `main`. Note: the browsing unit of work is called a **session** (not tab) — `domain.feature.session` not `domain.feature.tab`.
4. The resulting name is both the directory name and the npm package name: `@ctrl/<namespace>.<tier>.<name>`.

Examples:
- A new DB-backed repository for bookmarks → `domain.adapter.bookmark` → `@ctrl/domain.adapter.bookmark`
- Atomic business logic for bookmarks → `domain.feature.bookmark` → `@ctrl/domain.feature.bookmark`
- A new page composed from features → add it to `ui.scene.browser` → `@ctrl/ui.scene.browser`

For deep details see `docs/superpowers/specs/2026-03-14-domain-architecture-design.md` (Sections 2–3).
