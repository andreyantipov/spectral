# Package Naming Convention

All packages live in `packages/libs/`. Five namespaces, alphabetically ordered by dependency direction.

## Five Namespaces

```
a  arch.*              Technical tooling — contracts, implementations, utilities, middleware
b  base.*              Business foundations — models, specs, errors, events, types
f  feature.*           Pure business logic — flat FaaS functions (effects, guards, helpers)
u  ui.*                Presentation — components, hooks, features, scenes
w  wire.*              Composition roots — Layer wiring per deployment target
```

**Dependency direction: `arch → base → feature → ui → wire`**

Alphabetical order = dependency order. `arch.*` has zero business knowledge. `feature.*` imports `base.*` only. `wire.*` imports everything.

## Arch Tiers

| Tier | Package format | Role | Depends on |
|------|---------------|------|------------|
| contract | `arch.contract.<name>` | Pure interface (Context.Tag + type signatures) | nothing (zero deps) |
| impl | `arch.impl.<name>` | Implementation. **One Layer per package.** | `arch.contract.*` only |
| util | `arch.util.<name>` | Utilities (spec-builder, otel, mcp) | `arch.contract.*` only |

**Critical rule:** `arch.*` NEVER imports from `base.*`, `feature.*`, `ui.*`, or `wire.*`.

## Base Tiers

| Package | Purpose |
|---------|---------|
| `base.error` | Typed error classes |
| `base.event` | EventGroup definitions (business-typed events) |
| `base.model.<name>` | Drizzle tables + derived Effect Schema (source of truth for data) |
| `base.spec.<name>` | FSM spec definitions (actions, effects, guards, states, transitions) |
| `base.schema` | Shared schema utilities |
| `base.tracing` | `withTracing()` wrapper |
| `base.type` | Shared type utilities |

## Feature Packages (`feature.<domain>.<capability>`)

Pure flat functions. No EventBus, no actions. Return EffectResult.

| Package | Role | Depends on |
|---------|------|------------|
| `feature.browser.session` | Session CRUD effects | `base.model.session` |
| `feature.browser.navigation` | URL validation guards | `base.*` |
| `feature.browser.history` | History recording | `base.model.history` |
| `feature.workspace.layout` | Layout tree operations | `base.model.layout` |
| `feature.system.settings` | Settings + shortcuts | `base.*` |
| `feature.terminal.pty` | PTY lifecycle | `arch.contract.terminal` |

## Wire Packages (`wire.<target>.<side>`)

| Package | Role | Depends on |
|---------|------|------------|
| `wire.desktop.main` | Main-process Layer composition | everything above |
| `wire.desktop.ui` | Webview-process Layer composition | `arch.impl.*` |
| `wire.desktop.test` | Test harness | `arch.impl.*` |

## UI Packages

| Package | Role | Depends on |
|---------|------|------------|
| `ui.base.components` | Design tokens, Panda CSS, component toolkit | nothing internal |
| `ui.base.api` | Hooks (`useApi`, `RuntimeProvider`), EventBus bridge | `arch.contract.*` |
| `ui.feature.<name>` | UI feature components | `ui.base.*`, `base.spec.*` (for typed actions) |
| `ui.scene.<name>` | Scene composition | `ui.feature.*`, `ui.base.*` |

## Naming New Packages

1. Pick namespace by responsibility: tooling → arch, data/specs → base, business logic → feature, UI → ui, wiring → wire.
2. Use `feature.<domain>.<capability>` format for features.
3. Short lowercase nouns: `session`, `layout`, `sidebar`.
4. Package name = directory name = `@ctrl/<name>`.
