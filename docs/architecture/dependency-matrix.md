# Dependency Matrix

## Full Dependency Table

| Package | Can import |
|---------|-----------|
| `core.base.*` | External packages only (`effect`, `@effect/schema`) |
| `core.port.*` | `core.base.*` + external packages |
| `core.ui.design` | External (Panda CSS) |
| `core.ui.components` | `core.ui.design` (via tsconfig path alias only) |
| `core.ui.api` | `core.port.event-bus` |
| `domain.adapter.*` | `core.port.*` + `core.base.*` + external infrastructure libs |
| `domain.feature.*` | `core.port.*` + `core.base.*` (ports via DI — never adapters) |
| `domain.service.*` | `domain.feature.*` + `core.port.*` + `core.base.*` |
| `domain.runtime.*` | ALL domain + core packages (composition only) |
| `ui.feature.*` | `core.ui.components` + `core.ui.api` + `core.base.*` + `core.port.*` |
| `ui.scene.*` | `ui.feature.*` + `core.ui.components` |
| `packages/apps/*` | `domain.runtime.*` + `domain.adapter.carrier` + `ui.scene.*` |

## Key Rules

- **UI cannot import domain**: `ui.*` packages never import `domain.*` — they use `core.ui.api` (EventBus)
- **No re-exports**: barrel `index.ts` only exports from within its own package
- **Ports and adapters**: every `domain.adapter.*` implements a port (`core.port.*` or external lib interface)
- **Runtime = composition**: `domain.runtime.*` packages compose layers, exempt from barrel re-export rule

## Peer Isolation Rule

No package may import a peer at the same tier.

- `domain.feature.*` packages cannot import each other
- `domain.service.*` packages cannot import each other
- `domain.adapter.*` packages cannot import each other
- `ui.feature.*` packages cannot import each other
