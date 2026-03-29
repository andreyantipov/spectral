# Dependency Matrix

## Full Dependency Table

| Package | Can import |
|---------|-----------|
| `base.*` | External packages only (`effect`, `@effect/schema`) |
| `core.contract.*` | `base.*` + external packages |
| `core.impl.*` | `core.contract.*` + `base.*` + external infrastructure libs |
| `ui.base.components` | External (Panda CSS, styled-system generated internally) |
| `ui.base.api` | `core.contract.event-bus` |
| `domain.feature.*` | `core.contract.*` + `base.*` (contracts via DI — never impls) |
| `domain.service.*` | `domain.feature.*` + `core.contract.*` + `base.*` |
| `wire.desktop.*` | ALL domain + core + base packages (composition only) |
| `ui.feature.*` | `ui.base.components` + `ui.base.api` + `base.*` + `core.contract.*` |
| `ui.scene.*` | `ui.feature.*` + `ui.base.components` |
| `packages/apps/*` | `wire.desktop.*` + `ui.scene.*` |

## Key Rules

- **UI cannot import domain**: `ui.*` packages never import `domain.*` — they use `ui.base.api` (EventBus)
- **No re-exports**: barrel `index.ts` only exports from within its own package
- **Contracts and implementations**: every `core.impl.*` implements a contract (`core.contract.*` or external lib interface)
- **Wiring = composition**: `wire.desktop.*` packages compose layers, exempt from barrel re-export rule

## Peer Isolation Rule

No package may import a peer at the same tier.

- `domain.feature.*` packages cannot import each other
- `domain.service.*` packages cannot import each other
- `core.impl.*` packages cannot import each other
- `ui.feature.*` packages cannot import each other
