# Package Naming Convention

All packages live in `packages/libs/`. Four namespaces, ordered by dependency direction.

## Four Namespaces

```
b  base.*              Foundation utilities — errors, model, tracing, types
c  core.*.*            Contracts + implementations — ports and adapters (2-level)
d  domain.*.*          Business logic — features, services (2-level)
w  wire.*.*            Runtime wiring — Layer composition per deployment target (2-level)
u  ui.*                Presentation — design, components, api, features, scenes
```

**Dependency direction: `base → core → domain → ui`**

`base.*` packages have no internal deps. `core.*.*` depends on `base.*`. `domain.*.*` depends on `core.*.*` and `base.*`. `ui.*` depends on all.

## Core Tiers (`contract → impl`)

| Tier | Package format | Hex role | Depends on |
|------|---------------|----------|------------|
| contract | `core.contract.<name>` | Port (pure interface, Context.Tag + type signatures) | nothing |
| impl | `core.impl.<name>` | Driven adapter (implements contracts). **One Layer per package.** | `core.contract.*`, `base.*` |

## Domain Tiers (`feature → service`)

| Tier | Package format | Hex role | Depends on |
|------|---------------|----------|------------|
| feature | `domain.feature.<name>` | Atomic domain logic (single concern) | `core.contract.*`, `base.*` via DI |
| service | `domain.service.<name>` | Application service (composes features) | `domain.feature.*`, `core.contract.*`, `base.*` |

## Wire Packages (`wire.<target>.<side>`)

| Package | Role | Depends on |
|---------|------|------------|
| `wire.desktop.main` | Main-process Layer composition for desktop | everything above |
| `wire.desktop.ui` | Webview-process Layer composition for desktop | `core.impl.*` |

## UI Packages

| Package | Role | Depends on |
|---------|------|------------|
| `ui.base.components` | Design tokens, Panda CSS, styled-system, component toolkit | nothing (uses `@styled-system/*` path alias internally) |
| `ui.base.api` | Hooks (`useApi`, `RuntimeProvider`) | `core.contract.*` |
| `ui.feature.<name>` | Wires a domain service to a component | `ui.base.api`, `ui.base.components`, `core.contract.*` |
| `ui.scene.<name>` | Scene composition per concern | `ui.feature.*`, `ui.base.components` |

## Base Packages (always 1-level)

| Package | Purpose |
|---------|---------|
| `base.error` | Typed error classes |
| `base.schema` | Model.Class (Effect Schema base) |
| `base.tracing` | `withTracing()` wrapper |
| `base.type` | Shared type utilities |

## Two Public Surfaces

Only two tiers are importable from outside their own namespace:

- **`domain.service.*`** — the public API of all business logic (imported by `ui.feature.*`)
- **`ui.scene.*`** — the public API of all UI (imported by `packages/apps/*`)

Everything else is internal. ast-grep and GritQL enforce this.

## Naming New Packages

1. Pick the correct namespace based on what the package does (utilities → base, interfaces/adapters → core, business logic → domain, presentation → ui).
2. Pick the correct tier within that namespace.
3. Use a short, lowercase noun for the name: `session`, `bookmark`, `sidebar`, `main`. Note: the browsing unit of work is called a **session** (not tab) — `domain.feature.session` not `domain.feature.tab`.
4. The resulting name is both the directory name and the npm package name: `@ctrl/<name>`.

Examples:
- A new DB-backed repository for bookmarks → `core.impl.bookmark` → `@ctrl/core.impl.bookmark`
- Atomic business logic for bookmarks → `domain.feature.bookmark` → `@ctrl/domain.feature.bookmark`
- A new page composed from features → add it to `ui.scene.main` → `@ctrl/ui.scene.main`
