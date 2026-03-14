# Testing Strategy

## Four Testing Levels

| Level | What it verifies | Where it lives | Runs in CI? |
|-------|-----------------|----------------|-------------|
| L1: Unit | Single service logic, validation, pure functions | `domain.feature.*/api/*.test.ts`, `model/*.test.ts`, `lib/*.test.ts` | Yes |
| L2: Trace assertion | Data flows correctly across service boundaries | `domain.service.*/api/*.test.ts` | Yes |
| L3: Story interaction | UI renders and responds to user actions | `ui.feature.*/ui/*.stories.tsx` | Yes (Storybook) |
| L4: Pipeline trace | Full e2e flow from entry to DB and back via streams | `packages/apps/*/test/pipeline.test.ts` | Yes |

## What Each Level Catches

| Bug type | L1 | L2 | L3 | L4 |
|----------|----|----|----|----|
| Wrong business logic | ✓ | | | |
| Missing service call | | ✓ | | ✓ |
| Broken Layer wiring | | | | ✓ |
| Stream never delivers | | partial | | ✓ |
| Error swallowed silently | | | | ✓ |
| Orphan spans (broken trace propagation) | | | | ✓ |
| UI doesn't react to state change | | | ✓ | |

## L1: Unit Tests

Every `domain.feature.*` has unit tests with mocked ports. No DB, no real services.

Pattern: create a `MockRepo` Layer → compose with the feature Layer → run the effect.

```typescript
const MockRepo = Layer.succeed(TabRepository, {
  getAll: () => Effect.succeed([mockTab]),
  create: (url) => Effect.succeed({ id: "1", url, title: "" }),
  remove: (id) => Effect.succeed(void 0),
})

const TestLayer = TabFeatureLive.pipe(Layer.provide(MockRepo))
```

Tests run via `Effect.provide(TestLayer)` + `Effect.runPromise`.

## L2: Trace Assertions

Every `domain.service.*` has trace assertions verifying that service boundaries are crossed correctly. Uses `TestSpanExporter` (in-memory — no external Jaeger/Grafana required).

### `withTracing` + `spanName`

`withTracing(serviceName, service)` in `core.shared` automatically wraps every Effect/function method with `Effect.withSpan("ServiceName.methodName")`. Never add `Effect.withSpan()` manually.

`spanName(service, method)` derives span names using the same convention — single source of truth for both production tracing and test assertions:

```typescript
import { spanName } from "@ctrl/core.shared"
import { BROWSING_SERVICE } from "../lib/constants"
import { TAB_FEATURE } from "@ctrl/domain.feature.tab"

// In tests:
expect(spans).toContainSpan(spanName(BROWSING_SERVICE, "createTab"))
expect(spans).toContainSpan(spanName(TAB_FEATURE, "create"))
```

Service name constants (`TAB_FEATURE`, `BROWSING_SERVICE`, etc.) are defined in each package's `lib/constants.ts` and exported from the package index.

### Test Layer Setup

```typescript
const TestLayer = BrowsingServiceLive.pipe(
  Layer.provide(TabFeatureLive),
  Layer.provide(HistoryFeatureLive),
  Layer.provide(MockRepo),
  Layer.provide(TestSpanExporter.layer),  // from domain.adapter.otel
)
```

### `toContainSpan` Custom Matcher

A custom Vitest/Jest matcher for readable span assertions:

```typescript
expect(spans).toContainSpan(spanName(BROWSING_SERVICE, "createTab"))
```

Verify parent-child span chain is unbroken:

```typescript
const root = spans.find(s => !s.parentSpanId)
expect(root?.name).toBe(spanName(BROWSING_SERVICE, "createTab"))
const orphans = spans.filter(s =>
  s !== root && !spans.some(p => p.spanId === s.parentSpanId)
)
expect(orphans).toHaveLength(0)
```

## L3: Story Interaction Tests

Every `ui.feature.*` has Storybook stories with `play` functions that simulate user interactions and assert on rendered output. Run via Storybook test runner in CI.

## L4: Pipeline Trace

Integration tests in `packages/apps/*/test/` wire up the full Layer stack with only DB and transport mocked (in-memory SQLite + mock RPC transport). Verifies end-to-end data flow including reactive streams.

```typescript
const PipelineTestLayer = Layer.mergeAll(
  BrowsingServiceLive,
  TabFeatureLive,
  HistoryFeatureLive,
  MockDatabaseServiceLive,  // in-memory SQLite
  MockTransportLive,        // simulates RPC
  TestSpanExporter.layer,
)
```

L4 tests verify: stream delivers data after mutation, complete span chain with correct parent-child relationships, and zero error-status spans.

## Agent Development Loop

```
Agent writes code
  → runs L1 (unit tests) — is the logic correct?
  → runs L4 (pipeline trace) — is the wiring correct?
  → both pass → code is ready
  → pipeline fails → trace shows exactly which boundary broke
```

L2 and L3 run in CI. L1 and L4 are the fast local loop.

For deep details and full code examples see `docs/superpowers/specs/2026-03-14-domain-architecture-design.md` (Section 8).
