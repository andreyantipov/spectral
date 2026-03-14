# Dependency Matrix

## Full Dependency Table

| Package | Can import |
|---------|-----------|
| `core.shared` | External packages only (`effect`, `@effect/schema`) |
| `core.ui` | External packages only (`effect`, `solid-js`, etc.) |
| `domain.adapter.*` | `core.shared` + external infrastructure libs |
| `domain.feature.*` | `core.shared` (ports via DI — never adapters directly) |
| `domain.service.*` | `domain.feature.*` + `core.shared` |
| `ui.feature.*` | `domain.service.*` + `core.ui` + `core.shared` |
| `ui.page.*` | `ui.feature.*` + `core.ui` |
| `packages/apps/*` | `ui.page.*` only |

## Peer Isolation Rule

No package may import a peer at the same tier. Composition happens one level up.

- `domain.feature.*` packages cannot import each other — features are atomic
- `domain.service.*` packages cannot import each other — services compose features, not other services
- `domain.adapter.*` packages cannot import each other — adapters are independent
- `ui.feature.*` packages cannot import each other — UI features are atomic
- `ui.page.*` packages cannot import each other — pages are independent

## Valid and Invalid Imports

**Valid:**
```typescript
// ui.feature.sidebar importing from domain.service.*  ✓
import { BrowsingService } from "@ctrl/domain.service.browsing"

// domain.feature.tab importing from core.shared  ✓
import { TabRepository } from "@ctrl/core.shared"

// domain.service.browsing importing from domain.feature.*  ✓
import { TabFeature } from "@ctrl/domain.feature.tab"

// ui.page.main importing from ui.feature.*  ✓
import { SidebarFeature } from "@ctrl/ui.feature.sidebar"
```

**Invalid:**
```typescript
// ui.* importing from domain.feature.*  ✗
import { TabFeature } from "@ctrl/domain.feature.tab"

// ui.* importing from domain.adapter.*  ✗
import { TabRepositoryLive } from "@ctrl/domain.adapter.db"

// domain.feature.tab importing from domain.adapter.*  ✗
// (features use ports via DI, never adapters directly)
import { TabRepositoryLive } from "@ctrl/domain.adapter.db"

// domain.feature.tab importing a peer domain.feature.*  ✗
import { BookmarkFeature } from "@ctrl/domain.feature.bookmark"

// domain.service.browsing importing domain.adapter.*  ✗
import { DatabaseServiceLive } from "@ctrl/domain.adapter.db"

// apps importing ui.feature.*  ✗
import { SidebarFeature } from "@ctrl/ui.feature.sidebar"

// core.* importing domain.* or ui.*  ✗
import { TabFeature } from "@ctrl/domain.feature.tab"
```

## GritQL Enforcement

All boundaries are enforced by GritQL rules. Run `bunx grit check .` before committing.

Rule file location: `.grit/` in the repository root (see `docs/superpowers/specs/2026-03-14-domain-architecture-design.md` Section 7 for the full rule listing).

### Key rules covered:

- `ui.*` may only import `domain.service.*` from the domain namespace
- `apps/*` may only import `ui.page.*` from the UI namespace
- `domain.feature.*` uses ports (via DI), never adapters directly
- `domain.service.*` composes features only — no adapter imports, no peer service imports
- `domain.adapter.*` are independent — no cross-adapter imports, no feature/service imports
- `core.*` has no inward domain or UI imports
- `model/` never imports from `api/`
- `lib/` must be pure — no `yield*` / Effect services
- No `interface` declarations in `packages/libs/` — use `type` only
- No `Effect.withSpan()` calls — use `withTracing()` instead

For the full GritQL rule source see `docs/superpowers/specs/2026-03-14-domain-architecture-design.md` (Sections 7.1–7.5).
