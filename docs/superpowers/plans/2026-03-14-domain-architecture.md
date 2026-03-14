# Domain Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish hexagonal architecture with `core / domain / ui` namespaces, Effect.ts services, PubSub reactivity, OTEL telemetry, and factory-based codegen — validated via vertical slice (tabs feature).

**Architecture:** Three namespaces (`core.*`, `domain.*.*`, `ui.*.*`) with alphabetical sort = dependency direction. FSD segments (`model/`, `api/`, `lib/`, `ui/`) internally. Two public surfaces: `domain.service.*` and `ui.pages`. Reactivity via Effect PubSub → Stream → SolidJS signal bridge.

**Tech Stack:** Effect.ts, @effect/sql-drizzle, @effect/opentelemetry, @effect/rpc, Drizzle ORM, SolidJS, Panda CSS, Vitest, Storybook

**Spec Reference:** `docs/superpowers/specs/2026-03-14-domain-architecture-design.md`

**Deferred to next plan (not in scope):**
- `domain.adapter.rpc` implementation (scaffolded but empty — RPC transport wiring comes after headless architecture is validated)
- `domain.feature.bookmark`, `domain.feature.history` (second features for factory validation — next session)
- `makeFeatureService` factory extraction (build inline first, extract pattern after second feature)
- Storybook L3 story interaction tests (existing Storybook setup stays, new stories added with features in next plan)
- Drizzle migrations setup (`drizzle-kit` configuration — deferred until DB schema stabilizes)

**Pre-flight:** Tasks reference spec section numbers. Agent MUST read existing `core.ui/src/index.ts`, `core.shared/src/index.ts`, `feature.sidebar-tabs/`, and `apps/desktop/src/` before modifying them.

---

## Chunk 1: Foundation — Scaffolding + GritQL + core.shared

### Task 1: Scaffold all new packages

**Files:**
- Create: `packages/libs/domain.adapter.db/package.json`
- Create: `packages/libs/domain.adapter.db/tsconfig.json`
- Create: `packages/libs/domain.adapter.db/src/index.ts`
- Create: `packages/libs/domain.adapter.otel/package.json`
- Create: `packages/libs/domain.adapter.otel/tsconfig.json`
- Create: `packages/libs/domain.adapter.otel/src/index.ts`
- Create: `packages/libs/domain.adapter.rpc/package.json`
- Create: `packages/libs/domain.adapter.rpc/tsconfig.json`
- Create: `packages/libs/domain.adapter.rpc/src/index.ts`
- Create: `packages/libs/domain.feature.tab/package.json`
- Create: `packages/libs/domain.feature.tab/tsconfig.json`
- Create: `packages/libs/domain.feature.tab/src/index.ts`
- Create: `packages/libs/domain.service.browsing/package.json`
- Create: `packages/libs/domain.service.browsing/tsconfig.json`
- Create: `packages/libs/domain.service.browsing/src/index.ts`
- Create: `packages/libs/ui.feature.sidebar/package.json`
- Create: `packages/libs/ui.feature.sidebar/tsconfig.json`
- Create: `packages/libs/ui.feature.sidebar/src/index.ts`
- Create: `packages/libs/ui.pages/package.json`
- Create: `packages/libs/ui.pages/tsconfig.json`
- Create: `packages/libs/ui.pages/src/index.ts`

- [ ] **Step 1: Create domain.adapter.db package shell**

```json
// packages/libs/domain.adapter.db/package.json
{
  "name": "@ctrl/domain.adapter.db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsgo --build",
    "check": "tsgo --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@ctrl/core.shared": "workspace:*",
    "effect": "^3",
    "@effect/sql-drizzle": "*",
    "@effect/sql-libsql": "*",
    "drizzle-orm": "*"
  },
  "devDependencies": {
    "vitest": "*"
  }
}
```

```json
// packages/libs/domain.adapter.db/tsconfig.json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../core.shared" }
  ]
}
```

```typescript
// packages/libs/domain.adapter.db/src/index.ts
// domain.adapter.db — Drizzle + LibSQL database adapter
// Implements ports from @ctrl/core.shared
export {}
```

- [ ] **Step 2: Create domain.adapter.otel package shell**

Same pattern as Step 1 but with:
- `name`: `@ctrl/domain.adapter.otel`
- `dependencies`: `effect`, `@effect/opentelemetry`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/sdk-trace-base`
- `references`: `core.shared`

- [ ] **Step 3: Create domain.adapter.rpc package shell**

Same pattern with:
- `name`: `@ctrl/domain.adapter.rpc`
- `dependencies`: `effect`, `@effect/rpc`, `@effect/rpc-http`
- `references`: `core.shared`

- [ ] **Step 4: Create domain.feature.tab package shell**

Same pattern with:
- `name`: `@ctrl/domain.feature.tab`
- `dependencies`: `@ctrl/core.shared`, `effect`
- `references`: `core.shared`

- [ ] **Step 5: Create domain.service.browsing package shell**

Same pattern with:
- `name`: `@ctrl/domain.service.browsing`
- `dependencies`: `@ctrl/core.shared`, `@ctrl/domain.feature.tab`, `effect`
- `references`: `core.shared`, `domain.feature.tab`

- [ ] **Step 6: Create ui.feature.sidebar package shell**

Same pattern with:
- `name`: `@ctrl/ui.feature.sidebar`
- `dependencies`: `@ctrl/core.shared`, `@ctrl/core.ui`, `@ctrl/domain.service.browsing`, `effect`, `solid-js`
- `references`: `core.shared`, `core.ui`, `domain.service.browsing`

- [ ] **Step 7: Create ui.pages package shell**

Same pattern with:
- `name`: `@ctrl/ui.pages`
- `dependencies`: `@ctrl/core.ui`, `@ctrl/ui.feature.sidebar`, `solid-js`
- `references`: `core.ui`, `ui.feature.sidebar`

- [ ] **Step 8: Run `bun install` and verify workspace resolution**

Run: `bun install`
Expected: all workspace packages resolved, no errors

- [ ] **Step 9: Run `turbo check` to verify all packages compile**

Run: `npm run check`
Expected: all packages pass (empty index.ts files compile fine)

- [ ] **Step 10: Commit**

```bash
git add packages/libs/domain.* packages/libs/ui.*
git commit -m "chore: scaffold domain and ui packages for hex architecture"
```

---

### Task 2: Add GritQL boundary rules

**Files:**
- Create: `.grit/patterns/domain_boundary_rules.md`
- Create: `.grit/patterns/domain_peer_isolation.md`
- Create: `.grit/patterns/fsd_segment_rules.md`
- Create: `.grit/patterns/type_consistency.md`
- Create: `.grit/patterns/no_manual_withspan.md`

- [ ] **Step 1: Write domain boundary rules**

Create `.grit/patterns/domain_boundary_rules.md` with all rules from spec Section 7.1:
- `ui.*` cannot import `domain.feature.*` or `domain.adapter.*`
- `apps` can only import `ui.pages`
- `domain.feature.*` cannot import `domain.service.*` or `domain.adapter.*`
- `domain.service.*` cannot import `domain.adapter.*`
- `domain.adapter.*` cannot import `domain.feature.*` or `domain.service.*`
- `core.*` cannot import `domain.*` or `ui.*`

- [ ] **Step 2: Write peer isolation rules**

Create `.grit/patterns/domain_peer_isolation.md` with rules from spec Section 7.2:
- No cross-feature imports within `domain.feature.*`
- No cross-service imports within `domain.service.*`
- No cross-adapter imports within `domain.adapter.*`
- No cross-feature imports within `ui.feature.*`
- `ui.pages` is a single package (no peer isolation rule needed)

- [ ] **Step 3: Write FSD segment rules**

Create `.grit/patterns/fsd_segment_rules.md` with rules from spec Section 7.3:
- `model/` never imports from `api/`
- `lib/` must be pure (no `yield*`)

- [ ] **Step 4: Write type consistency rule**

Create `.grit/patterns/type_consistency.md` from spec Section 7.4:
- No `interface` declarations in `packages/libs/`

- [ ] **Step 5: Write no-manual-withspan rule**

Create `.grit/patterns/no_manual_withspan.md` from spec Section 7.5:
- No `Effect.withSpan()` calls in `packages/libs/`

- [ ] **Step 6: Run grit check to verify rules don't break existing code**

Run: `bunx grit check .`
Expected: passes (existing code doesn't violate new rules, or violations are in packages being replaced)

- [ ] **Step 7: Commit**

```bash
git add .grit/patterns/
git commit -m "chore: add GritQL rules for hex architecture boundaries"
```

---

### Task 3: Update core.shared — ports, types, utilities

**Files:**
- Create: `packages/libs/core.shared/src/model/ports.ts`
- Create: `packages/libs/core.shared/src/model/types.ts`
- Create: `packages/libs/core.shared/src/model/errors.ts`
- Create: `packages/libs/core.shared/src/lib/with-tracing.ts`
- Create: `packages/libs/core.shared/src/lib/span-name.ts`
- Modify: `packages/libs/core.shared/src/index.ts`
- Modify: `packages/libs/core.shared/package.json`

- [ ] **Step 1: Add `effect` and `@effect/schema` dependencies to core.shared**

Modify `packages/libs/core.shared/package.json` to add:
```json
"dependencies": {
  "effect": "^3",
  "@effect/schema": "*"
}
```

Run: `bun install`

- [ ] **Step 2: Write the `withTracing` utility**

Create `packages/libs/core.shared/src/lib/with-tracing.ts` — implementation from spec Section 6.1.

- [ ] **Step 3: Write the `spanName` helper**

Create `packages/libs/core.shared/src/lib/span-name.ts` — implementation from spec Section 8.5.

- [ ] **Step 4: Write shared error types**

Create `packages/libs/core.shared/src/model/errors.ts`:

```typescript
import { Data } from "effect"

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
  readonly field?: string
}> {}
```

- [ ] **Step 5: Write domain types**

Create `packages/libs/core.shared/src/model/types.ts` — `Tab` type from spec Section 4.3.

- [ ] **Step 6: Write port definitions**

Create `packages/libs/core.shared/src/model/ports.ts` — `DatabaseService` and `TabRepository` Context.Tags from spec Section 4.1. Use ID constants, not hardcoded strings.

- [ ] **Step 7: Update index.ts to re-export all public API**

```typescript
// packages/libs/core.shared/src/index.ts
export * from "./model/ports"
export * from "./model/types"
export * from "./model/errors"
export { withTracing } from "./lib/with-tracing"
export { spanName } from "./lib/span-name"
```

- [ ] **Step 8: Verify compilation**

Run: `cd packages/libs/core.shared && bun run check`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/libs/core.shared/
git commit -m "feat(core.shared): add ports, domain types, withTracing, and spanName utilities"
```

---

### Task 4: Set up Vitest

**Files:**
- Create: `vitest.config.ts` (root)
- Modify: `package.json` (root — add vitest script)
- Modify: `turbo.json` (update test task)

- [ ] **Step 1: Install vitest**

Run: `bun add -d vitest @vitest/coverage-v8`

- [ ] **Step 2: Create root vitest config**

Create `vitest.config.ts` from spec Section 8.9.

- [ ] **Step 3: Update root package.json test script**

Ensure `"test": "turbo test"` exists in root scripts.

- [ ] **Step 4: Verify vitest runs (no tests yet, should pass with 0)**

Run: `bunx vitest run`
Expected: 0 tests, pass

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json turbo.json
git commit -m "chore: configure vitest for monorepo testing"
```

---

## Chunk 2: Database Adapter + Tab Feature (Headless Domain)

### Task 5: Implement domain.adapter.db — schema + makeRepository

**Files:**
- Create: `packages/libs/domain.adapter.db/src/model/tabs.schema.ts`
- Create: `packages/libs/domain.adapter.db/src/lib/make-repository.ts`
- Create: `packages/libs/domain.adapter.db/src/lib/constants.ts`
- Create: `packages/libs/domain.adapter.db/src/lib/client.ts`
- Create: `packages/libs/domain.adapter.db/src/api/tab.repository.ts`
- Create: `packages/libs/domain.adapter.db/src/api/tab.repository.test.ts`
- Modify: `packages/libs/domain.adapter.db/src/index.ts`

- [ ] **Step 1: Write the Drizzle table schema**

Create `packages/libs/domain.adapter.db/src/model/tabs.schema.ts` — from spec Section 4.3.
Include `satisfies` check against `Tab` type from `@ctrl/core.shared`.

- [ ] **Step 2: Write the `makeRepository` factory**

Create `packages/libs/domain.adapter.db/src/lib/make-repository.ts` — from spec Section 6.2.
Uses `withTracing(table._.name, {...})`.

- [ ] **Step 3: Write the DB client setup**

Create `packages/libs/domain.adapter.db/src/lib/client.ts`:

```typescript
import { LibsqlClient } from "@effect/sql-libsql"
import { Layer } from "effect"

export const makeDbClient = (url: string) =>
  LibsqlClient.layer({ url })
```

- [ ] **Step 4: Write the tab repository test (TDD — test first)**

Create `packages/libs/domain.adapter.db/src/api/tab.repository.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { Effect, Layer } from "effect"
import { TabRepository } from "@ctrl/core.shared"
import { TabRepositoryLive } from "./tab.repository"
// Use in-memory SQLite for tests
// ... test that getAll returns empty, create adds tab, remove deletes tab
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd packages/libs/domain.adapter.db && bunx vitest run`
Expected: FAIL (TabRepositoryLive not implemented)

- [ ] **Step 6: Write the tab repository implementation**

Create `packages/libs/domain.adapter.db/src/api/tab.repository.ts` — from spec Section 4.2.
Spread `makeRepository(tabsTable)` + custom `getActive` query. Wrap in `withTracing`.

- [ ] **Step 7: Update index.ts**

```typescript
export { TabRepositoryLive } from "./api/tab.repository"
export { tabsTable } from "./model/tabs.schema"
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/libs/domain.adapter.db && bunx vitest run`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/libs/domain.adapter.db/
git commit -m "feat(domain.adapter.db): implement Drizzle schema, makeRepository, and TabRepository"
```

---

### Task 6: Implement domain.adapter.otel — telemetry + test utilities

**Files:**
- Create: `packages/libs/domain.adapter.otel/src/model/otel.config.ts`
- Create: `packages/libs/domain.adapter.otel/src/lib/constants.ts`
- Create: `packages/libs/domain.adapter.otel/src/api/otel.test-utils.ts`
- Modify: `packages/libs/domain.adapter.otel/src/index.ts`

- [ ] **Step 1: Write OTEL constants**

Create `packages/libs/domain.adapter.otel/src/lib/constants.ts`:

```typescript
export const OTEL_SERVICE_NAMES = {
  main: "ctrl.page.main",
  webview: "ctrl.page.webview",
} as const
```

- [ ] **Step 2: Write OTEL production config**

Create `packages/libs/domain.adapter.otel/src/model/otel.config.ts` — from spec Section 8.2. Parameterized `OtelLive` factory.

- [ ] **Step 3: Write test utilities — TestSpanExporter + toContainSpan matcher**

Create `packages/libs/domain.adapter.otel/src/api/otel.test-utils.ts`:
- Wrap `InMemorySpanExporter` from `@opentelemetry/sdk-trace-base` as an Effect Layer
- Export `TestSpanExporter` Context.Tag + Layer
- Export `toContainSpan` custom Vitest matcher

- [ ] **Step 4: Update index.ts**

```typescript
export { OtelLive } from "./model/otel.config"
export { TestSpanExporter, toContainSpanMatcher } from "./api/otel.test-utils"
export { OTEL_SERVICE_NAMES } from "./lib/constants"
```

- [ ] **Step 5: Verify compilation**

Run: `cd packages/libs/domain.adapter.otel && bun run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.adapter.otel/
git commit -m "feat(domain.adapter.otel): implement OTEL layers and test span utilities"
```

---

### Task 7: Implement domain.feature.tab — service + reactivity

**Files:**
- Create: `packages/libs/domain.feature.tab/src/model/tab.events.ts`
- Create: `packages/libs/domain.feature.tab/src/model/tab.validators.ts`
- Create: `packages/libs/domain.feature.tab/src/lib/constants.ts`
- Create: `packages/libs/domain.feature.tab/src/api/tab.service.ts`
- Create: `packages/libs/domain.feature.tab/src/api/tab.service.test.ts`
- Modify: `packages/libs/domain.feature.tab/src/index.ts`

- [ ] **Step 1: Write tab feature constants**

```typescript
// packages/libs/domain.feature.tab/src/lib/constants.ts
export const TAB_FEATURE = "TabFeature" as const
```

- [ ] **Step 2: Write tab events (PubSub + Stream types)**

Create `packages/libs/domain.feature.tab/src/model/tab.events.ts`:

```typescript
import { PubSub, Stream } from "effect"
import type { Tab } from "@ctrl/core.shared"

export type TabChanges = Stream.Stream<Tab[]>
```

- [ ] **Step 3: Write tab validators**

Create `packages/libs/domain.feature.tab/src/model/tab.validators.ts`:

```typescript
import { Schema } from "@effect/schema"

export const CreateTabInput = Schema.Struct({
  url: Schema.String.pipe(Schema.filter((s) => s.startsWith("http") || s === "about:blank")),
})
```

- [ ] **Step 4: Write the tab service test (TDD — test first)**

Create `packages/libs/domain.feature.tab/src/api/tab.service.test.ts` — from spec Section 8.4. Mock `TabRepository`, verify:
- `create` publishes to stream
- `getAll` returns data
- `remove` publishes updated state

- [ ] **Step 5: Run test to verify it fails**

Run: `cd packages/libs/domain.feature.tab && bunx vitest run`
Expected: FAIL

- [ ] **Step 6: Write the tab service implementation**

Create `packages/libs/domain.feature.tab/src/api/tab.service.ts` — from spec Section 5.4.
Uses `withTracing(TAB_FEATURE, {...})`, PubSub for reactivity, `Stream.fromPubSub`.

- [ ] **Step 7: Update index.ts**

```typescript
export { TabFeature, TabFeatureLive } from "./api/tab.service"
export { TAB_FEATURE } from "./lib/constants"
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/libs/domain.feature.tab && bunx vitest run`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/libs/domain.feature.tab/
git commit -m "feat(domain.feature.tab): implement tab service with PubSub reactivity"
```

---

### Task 8: Implement domain.service.browsing — composed service

**Files:**
- Create: `packages/libs/domain.service.browsing/src/model/browsing.events.ts`
- Create: `packages/libs/domain.service.browsing/src/lib/constants.ts`
- Create: `packages/libs/domain.service.browsing/src/api/browsing.service.ts`
- Create: `packages/libs/domain.service.browsing/src/api/browsing.service.test.ts`
- Modify: `packages/libs/domain.service.browsing/src/index.ts`

- [ ] **Step 1: Write browsing service constants**

```typescript
// packages/libs/domain.service.browsing/src/lib/constants.ts
export const BROWSING_SERVICE = "BrowsingService" as const
```

- [ ] **Step 2: Write browsing events (composed state type)**

```typescript
// packages/libs/domain.service.browsing/src/model/browsing.events.ts
import type { Tab } from "@ctrl/core.shared"

export type BrowsingState = {
  readonly tabs: Tab[]
}
```

- [ ] **Step 3: Write the trace assertion test (TDD — test first)**

Create `packages/libs/domain.service.browsing/src/api/browsing.service.test.ts` — adapted from spec Section 8.5.
**Note:** History feature is deferred. This test verifies tabs-only flow: `BrowsingService.createTab → TabFeature.create → TabRepository.create`.
Import `spanName`, `BROWSING_SERVICE`, `TAB_FEATURE` constants. Assert on span names, parent-child chain, zero errors.

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/libs/domain.service.browsing && bunx vitest run`
Expected: FAIL

- [ ] **Step 5: Write the browsing service implementation**

Create `packages/libs/domain.service.browsing/src/api/browsing.service.ts` — adapted from spec Section 5.5.
**Note:** History feature is deferred. Initial implementation wraps TabFeature only. `changes` exposes tab stream directly (no `combineLatest` yet — that comes when history is added).
Uses `withTracing(BROWSING_SERVICE, {...})`.

- [ ] **Step 6: Update index.ts**

```typescript
export { BrowsingService, BrowsingServiceLive } from "./api/browsing.service"
export { BROWSING_SERVICE } from "./lib/constants"
export type { BrowsingState } from "./model/browsing.events"
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd packages/libs/domain.service.browsing && bunx vitest run`
Expected: PASS — all trace assertions pass

- [ ] **Step 8: Commit**

```bash
git add packages/libs/domain.service.browsing/
git commit -m "feat(domain.service.browsing): implement composed browsing service with trace assertions"
```

---

## Chunk 3: UI Bridge + Feature Wiring + Pipeline Tests

### Task 9: Implement core.ui bridge utilities

**Files:**
- Create: `packages/libs/core.ui/src/lib/runtime-provider.ts`
- Create: `packages/libs/core.ui/src/lib/use-stream.ts`
- Create: `packages/libs/core.ui/src/lib/use-service.ts`
- Create: `packages/libs/core.ui/src/lib/use-domain-service.ts`
- Modify: `packages/libs/core.ui/src/index.ts`
- Modify: `packages/libs/core.ui/package.json`

- [ ] **Step 1: Add `effect` dependency to core.ui**

Modify `packages/libs/core.ui/package.json` to add `"effect": "^3"` to dependencies.

Run: `bun install`

**Pre-flight:** Read `packages/libs/core.ui/src/index.ts` to understand existing exports before modifying.

- [ ] **Step 2: Write RuntimeProvider**

Create `packages/libs/core.ui/src/lib/runtime-provider.ts` — from spec Section 5.6.

- [ ] **Step 3: Write useStream**

Create `packages/libs/core.ui/src/lib/use-stream.ts` — from spec Section 5.6.
Includes `runWithOwner` for SolidJS reactive ownership.

- [ ] **Step 4: Write useService**

Create `packages/libs/core.ui/src/lib/use-service.ts` — from spec Section 5.6.
Uses `runtime.runSync(Effect.service(tag))`.

- [ ] **Step 5: Write useDomainService**

Create `packages/libs/core.ui/src/lib/use-domain-service.ts` — from spec Section 6.4.

- [ ] **Step 6: Export bridge utilities from core.ui index**

Add to `packages/libs/core.ui/src/index.ts`:
```typescript
export { RuntimeProvider, useRuntime } from "./lib/runtime-provider"
export { useStream } from "./lib/use-stream"
export { useService } from "./lib/use-service"
export { useDomainService } from "./lib/use-domain-service"
```

- [ ] **Step 7: Verify compilation**

Run: `cd packages/libs/core.ui && bun run check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/libs/core.ui/
git commit -m "feat(core.ui): add Effect-SolidJS bridge utilities (useStream, useService, RuntimeProvider)"
```

---

### Task 10: Implement ui.feature.sidebar

**Files:**
- Create: `packages/libs/ui.feature.sidebar/src/model/sidebar.bindings.ts`
- Create: `packages/libs/ui.feature.sidebar/src/api/use-sidebar.ts`
- Create: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx`
- Modify: `packages/libs/ui.feature.sidebar/src/index.ts`

- [ ] **Step 1: Write sidebar bindings (domain state → component props mapping)**

Create `packages/libs/ui.feature.sidebar/src/model/sidebar.bindings.ts`:

```typescript
import type { BrowsingState } from "@ctrl/domain.service.browsing"
import type { Tab } from "@ctrl/core.shared"

export const mapTabsToSidebarItems = (state: BrowsingState | undefined) =>
  state?.tabs.map((tab: Tab) => ({
    id: tab.id,
    label: tab.title ?? new URL(tab.url).hostname,
    active: tab.isActive,
  })) ?? []
```

- [ ] **Step 2: Write the service hook**

Create `packages/libs/ui.feature.sidebar/src/api/use-sidebar.ts`:

```typescript
import { useDomainService } from "@ctrl/core.ui"
import { BrowsingService } from "@ctrl/domain.service.browsing"

export const useBrowsingService = () => useDomainService(BrowsingService)
```

- [ ] **Step 3: Write the SidebarFeature component**

Create `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx` — thin composition from spec Section 6.4.
Uses `useBrowsingService()`, `useSidebar()` from core.ui, renders `<Sidebar>` with compound slots.

- [ ] **Step 4: Update index.ts**

```typescript
export { SidebarFeature } from "./ui/SidebarFeature"
```

- [ ] **Step 5: Verify compilation**

Run: `cd packages/libs/ui.feature.sidebar && bun run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/ui.feature.sidebar/
git commit -m "feat(ui.feature.sidebar): implement sidebar feature with domain service binding"
```

---

### Task 11: Implement ui.pages

**Files:**
- Create: `packages/libs/ui.pages/src/ui/MainPage.tsx`
- Modify: `packages/libs/ui.pages/src/index.ts`

- [ ] **Step 1: Write the MainPage component**

Create `packages/libs/ui.pages/src/ui/MainPage.tsx`:

```tsx
import { SidebarFeature } from "@ctrl/ui.feature.sidebar"

export function MainPage() {
  return (
    <div>
      <SidebarFeature />
      {/* BrowserView content area — will use AppShell template in future */}
    </div>
  )
}
```

- [ ] **Step 2: Update index.ts**

```typescript
export { MainPage } from "./ui/MainPage"
```

- [ ] **Step 3: Verify compilation**

Run: `cd packages/libs/ui.pages && bun run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/libs/ui.pages/
git commit -m "feat(ui.pages): implement main page composing sidebar feature"
```

---

### Task 12: Full pipeline trace test

**Files:**
- Create: `packages/apps/desktop/src/test/pipeline.test.ts`
- Create: `packages/apps/desktop/src/test/test-layers.ts`

- [ ] **Step 1: Write shared test layers**

Create `packages/apps/desktop/src/test/test-layers.ts`:
- `MockDatabaseServiceLive` — in-memory mock of TabRepository
- `PipelineTestLayer` — merges BrowsingServiceLive + TabFeatureLive + mock TabRepository + TestSpanExporter (no history — deferred)

- [ ] **Step 2: Write the pipeline trace test**

Create `packages/apps/desktop/src/test/pipeline.test.ts` — adapted from spec Section 8.7.
**Note:** No history feature yet. Verify tabs-only flow: subscribe → createTab → stream delivers → trace chain (`BrowsingService.createTab → TabFeature.create → TabRepository.create`) → zero errors.

- [ ] **Step 3: Run pipeline test**

Run: `bunx vitest run packages/apps/desktop/src/test/pipeline.test.ts`
Expected: PASS — complete trace chain verified

- [ ] **Step 4: Commit**

```bash
git add packages/apps/desktop/src/test/
git commit -m "test: add full pipeline trace test verifying end-to-end data flow"
```

---

## Chunk 4: App Wiring + Cleanup + Documentation

### Task 13: Update desktop app composition root

**Files:**
- Modify: `packages/apps/desktop/src/bun/layers.ts`
- Modify: `packages/apps/desktop/src/bun/index.ts`
- Modify: `packages/apps/desktop/src/main-ui/App.tsx`

- [ ] **Step 1: Update bun/layers.ts to use new architecture**

Replace the existing Layer composition with new packages:
```typescript
import { TabRepositoryLive } from "@ctrl/domain.adapter.db"
import { OtelLive } from "@ctrl/domain.adapter.otel"
import { TabFeatureLive } from "@ctrl/domain.feature.tab"
import { BrowsingServiceLive } from "@ctrl/domain.service.browsing"
import { Layer } from "effect"

export const DesktopLive = BrowsingServiceLive.pipe(
  Layer.provide(TabFeatureLive),
  Layer.provide(TabRepositoryLive),
  Layer.provide(OtelLive(OTEL_SERVICE_NAMES.main)),
)
```

- [ ] **Step 2: Update main-ui/App.tsx to use RuntimeProvider + ui.pages**

```tsx
import { RuntimeProvider } from "@ctrl/core.ui"
import { MainPage } from "@ctrl/ui.pages"

export function App(props: { runtime: ManagedRuntime<any> }) {
  return (
    <RuntimeProvider runtime={props.runtime}>
      <MainPage />
    </RuntimeProvider>
  )
}
```

- [ ] **Step 3: Verify desktop app builds**

Run: `turbo build --filter=@ctrl/desktop`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/apps/desktop/
git commit -m "feat(desktop): wire new hex architecture into desktop app composition root"
```

---

### Task 14: Remove deprecated packages

**Files:**
- Remove: `packages/libs/core.db/` (replaced by `domain.adapter.db`)
- Remove: `packages/libs/feature.sidebar-tabs/` (replaced by domain + ui packages)
- Modify: any imports referencing old packages

- [ ] **Step 1: Search for all imports of `@ctrl/core.db` and `@ctrl/feature.sidebar-tabs`**

Run: `grep -r "@ctrl/core.db\|@ctrl/feature.sidebar-tabs" packages/ --include="*.ts" --include="*.tsx" --include="*.json" -l`

- [ ] **Step 2: Update all references to use new packages**

Replace `@ctrl/core.db` → `@ctrl/domain.adapter.db`
Replace `@ctrl/feature.sidebar-tabs` → `@ctrl/domain.service.browsing` + `@ctrl/ui.feature.sidebar`

- [ ] **Step 3: Remove deprecated packages**

```bash
rm -rf packages/libs/core.db
rm -rf packages/libs/feature.sidebar-tabs
```

- [ ] **Step 4: Run full build and test**

Run: `npm run check && bunx vitest run`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove core.db and feature.sidebar-tabs (replaced by hex architecture)"
```

---

### Task 15: Write architecture documentation

**Files:**
- Create: `docs/architecture/package-naming.md`
- Create: `docs/architecture/fsd-segments.md`
- Create: `docs/architecture/dependency-matrix.md`
- Create: `docs/architecture/testing-strategy.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write package naming guide**

Create `docs/architecture/package-naming.md`:
- Three namespaces: `core.*`, `domain.*.*`, `ui.*.*`
- Alphabetical = dependency direction
- Second-level tiers within domain and ui
- Two public surfaces
- How to name new packages

- [ ] **Step 2: Write FSD segments guide**

Create `docs/architecture/fsd-segments.md`:
- Four segments: `model/`, `api/`, `lib/`, `ui/`
- Rules for each segment
- Which packages use which segments

- [ ] **Step 3: Write dependency matrix**

Create `docs/architecture/dependency-matrix.md`:
- Full table from spec Section 2.2
- GritQL rule references
- Examples of valid and invalid imports

- [ ] **Step 4: Write testing strategy guide**

Create `docs/architecture/testing-strategy.md`:
- Four levels (unit, trace, story, pipeline)
- `withTracing` + `spanName` usage
- Test layer setup patterns
- `toContainSpan` matcher usage

- [ ] **Step 5: Update CLAUDE.md with architecture references**

Add section to `CLAUDE.md`:
```markdown
## Architecture

- Package naming: see `docs/architecture/package-naming.md`
- FSD segments: see `docs/architecture/fsd-segments.md`
- Dependencies: see `docs/architecture/dependency-matrix.md`
- Testing: see `docs/architecture/testing-strategy.md`
- Full spec: see `docs/superpowers/specs/2026-03-14-domain-architecture-design.md`

### Key Rules
- `type` only, never `interface`
- No `Effect.withSpan()` — use `withTracing()` from `@ctrl/core.shared`
- No hardcoded strings for span names or service identifiers
- GritQL enforces all boundaries — run `bunx grit check .` before committing
```

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/ CLAUDE.md
git commit -m "docs: add architecture guides for package naming, FSD segments, dependencies, and testing"
```

---

### Task 16: Final validation

- [ ] **Step 1: Run full lint**

Run: `npm run lint`
Expected: PASS (all GritQL rules, Biome, typecheck)

- [ ] **Step 2: Run all tests**

Run: `bunx vitest run`
Expected: all unit tests + trace assertions + pipeline test pass

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: all packages build

- [ ] **Step 4: Verify desktop app starts**

Run: `npm run dev:desktop`
Expected: app launches with sidebar, tabs work

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final validation fixes for hex architecture migration"
```
