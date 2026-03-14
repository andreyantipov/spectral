# Domain Architecture Design

**Date:** 2026-03-14
**Status:** Draft
**Scope:** Package naming, hex architecture, FSD internal segments, reactivity, telemetry, testing strategy, codegen reduction

---

## 1. Problem Statement

The current codebase lacks a principled architecture for delivering features. Business logic, transport, reactivity, and presentation are not clearly separated. There are no unit tests, no telemetry, and no enforceable dependency rules. As the project grows, this makes it increasingly difficult to add features safely, test them in isolation, or refactor without cascading changes.

This spec establishes the foundational architecture for ctrl.page — a hexagonal design with clean package boundaries, headless-testable services, transport-agnostic reactivity, and development telemetry. The goal is to create a structure where every new feature follows a clear, repeatable path from database to UI, with each layer independently testable and replaceable.

---

## 2. Architecture Overview

### 2.1 Three Namespaces

All packages live in `packages/libs/`. Three top-level namespaces, alphabetically sorted to match dependency direction:

```
c  core.*           Foundation (schemas, ports, UI toolkit)
d  domain.*.*       All business logic (adapters, features, services)
u  ui.*.*           All presentation (feature widgets, composed pages)
```

`c → d → u` — alphabetical order equals dependency direction.

### 2.2 Hexagonal Layers

Within `domain.*.*` and `ui.*.*`, the second level encodes the hex tier. Second-level names also sort alphabetically to match dependency direction within their namespace:

**domain.\*.\* — `a → f → s`:**

| Tier | Hex role | Visibility | Depends on |
|------|----------|------------|------------|
| `domain.adapter.*` | Driven adapter (implements ports) | INTERNAL | `core.shared` |
| `domain.feature.*` | Atomic domain logic (single concern) | INTERNAL | `core.shared` (ports via DI) |
| `domain.service.*` | Application service (composes features) | **PUBLIC** | `domain.feature.*` + `core.shared` |

**ui.\*.\* — `f → p`:**

| Tier | Hex role | Visibility | Depends on |
|------|----------|------------|------------|
| `ui.feature.*` | Presentation adapter (wires service → component) | INTERNAL | `domain.service.*` + `core.ui` + `core.shared` |
| `ui.page.*` | Composed scene (fills template slots) | **PUBLIC** | `ui.feature.*` + `core.ui` |

**core.\* — foundation (always 2-level):**

| Package | Purpose |
|---------|---------|
| `core.shared` | Ports (Context.Tags), domain types, shared errors. Ports are placed in `model/` because they are type-level contracts, not implementations. |
| `core.ui` | Component toolkit (atoms, molecules, organisms, templates) + `useStream`/`useService` utilities |

### 2.3 Two Public Surfaces

Only two tiers are importable from **outside** their namespace:

- **`domain.service.*`** — the public API of all business logic (imported by `ui.feature.*`)
- **`ui.page.*`** — the public API of all UI (imported by `packages/apps/*`)

Everything else is internal. GritQL enforces this (see Section 7).

**Intra-namespace imports** follow the tier dependency direction:
- Within `domain`: `adapter → feature → service` (higher tiers import lower tiers)
- Within `ui`: `feature → page` (page imports feature)

**Inter-namespace imports** use public surfaces only:
- `ui.*` imports `domain.service.*` only (never `domain.feature.*` or `domain.adapter.*`)
- `packages/apps/*` imports `ui.page.*` only (never `ui.feature.*`)

### 2.4 Core Package Independence

`core.shared` and `core.ui` are fully independent — no dependency between them:

- `core.shared` depends on: `effect`, `@effect/schema` (external only)
- `core.ui` depends on: `effect`, `solid-js`, `@pandacss/dev`, `@zag-js/solid` (external only)

Bridge utilities in `core.ui` (`useStream`, `useService`, `useDomainService`) are generic — they use `Context.Tag` and `Stream` from `effect` directly, not from `core.shared`. No core package imports another core package.

### 2.5 Composition Root

Wiring of adapters + features + services into a runnable Layer stack happens in the app, not in libs:

```
packages/apps/desktop/
├── src/
│   ├── bun/
│   │   └── layers.ts           Bun process: real adapters + all services
│   └── main-ui/
│       └── layers.ts           Webview: RPC client layers + OTEL
```

Different apps (desktop, web, test) provide different Layer compositions. No package in `libs/` knows the wiring.

---

## 3. Package Structure

### 3.1 Full Package Map

```
packages/libs/
├── core.shared/                    Ports, types, errors
├── core.ui/                        Component toolkit + bridge utilities
│
├── domain.adapter.turso/           DB: Drizzle + @effect/sql-drizzle + LibSQL
├── domain.adapter.otel/            Telemetry: @effect/opentelemetry
├── domain.adapter.rpc/             Transport: @effect/rpc server + client
├── domain.feature.tab/             Atomic: tab business logic
├── domain.feature.bookmark/        Atomic: bookmark business logic
├── domain.feature.history/         Atomic: history business logic
├── domain.service.browsing/        Composed: tab + history + navigation
│
├── ui.feature.sidebar/             Wires BrowsingService → Sidebar
├── ui.feature.omnibar/             Wires BrowsingService → AddressBar
├── ui.page.main/                   Composes features into AppShell template
```

### 3.2 FSD Internal Segments

Every package uses Feature-Sliced Design segments internally. Four universal segment names apply to all packages regardless of hex layer:

| Segment | Purpose | Rule |
|---------|---------|------|
| `model/` | Types, state, events, schemas, validators | **What this slice knows.** Never imports from `api/`. |
| `api/` | Service impl, repository impl, bindings | **What this slice does.** The capability layer. |
| `lib/` | Pure functions, factories, helpers | **Reusable utilities.** No Effect services, no side effects. |
| `ui/` | Components, stories | **What this slice shows.** Only in `ui.*` and `core.ui`. |

**Segment rules:**

1. Same 4 segment names everywhere — `model/`, `api/`, `lib/`, `ui/`.
2. Only create segments that have content — don't create empty folders.
3. Tests co-locate inside their segment (`tab.service.test.ts` next to `tab.service.ts`).
4. `lib/` is always pure — no Effect services, no side effects, plain function unit tests.
5. `model/` never imports from `api/` — models are dependencies, not dependents.

**Which segments each layer uses:**

```
                          model/    api/    lib/    ui/
                          ──────    ────    ────    ────
core.shared                 ✓
core.ui                     ✓                ✓       ✓
domain.adapter.*            ✓        ✓       ✓
domain.feature.*            ✓        ✓       ✓
domain.service.*            ✓        ✓
ui.feature.*                ✓        ✓               ✓
ui.page.*                                            ✓
```

### 3.3 Concrete Package Structures

**core.shared:**
```
src/
├── model/
│   ├── ports.ts                    Context.Tags: DatabaseService, TabRepository, etc.
│   │                               (Ports live in model/ because they are type-level contracts)
│   ├── types.ts                    Domain types — manually defined interfaces (Tab, Bookmark, etc.)
│   │                               These are the canonical shapes. Adapters map DB rows to these types.
│   └── errors.ts                   Shared error types
└── index.ts
```

**domain.adapter.turso:**
```
src/
├── model/
│   ├── tabs.schema.ts              Drizzle table definition (SOURCE OF TRUTH)
│   ├── bookmarks.schema.ts
│   └── migrations/
├── api/
│   ├── tab.repository.ts           Implements TabRepository port
│   └── tab.repository.test.ts
├── lib/
│   ├── make-repository.ts          Generic CRUD factory
│   └── client.ts                   LibSQL connection setup
└── index.ts                        Exports DatabaseServiceLive Layer
```

**domain.adapter.otel:**
```
src/
├── model/
│   └── otel.config.ts              Exporter config, service name
├── api/
│   └── otel.test-utils.ts          TestSpanExporter helpers for tests
└── index.ts                        Exports OtelLive Layer
```

**domain.adapter.rpc:**
```
src/
├── api/
│   ├── rpc.server.ts               @effect/rpc router setup
│   └── rpc.client.ts               @effect/rpc client proxy
├── lib/
│   └── electrobun.transport.ts     Electrobun RPC transport adapter
└── index.ts
```

**domain.feature.tab:**
```
src/
├── model/
│   ├── tab.events.ts               PubSub + Stream definitions
│   └── tab.validators.ts           Effect Schema validation
├── api/
│   ├── tab.service.ts              Feature service + PubSub reactivity
│   └── tab.service.test.ts         Unit tests (mock ports)
└── index.ts                        Exports TabFeatureLive Layer
```

**domain.service.browsing:**
```
src/
├── model/
│   └── browsing.events.ts          Composed streams from features
├── api/
│   ├── browsing.service.ts         Orchestrates features
│   └── browsing.service.test.ts    Trace assertions (OTEL)
└── index.ts                        PUBLIC API of domain
```

**ui.feature.sidebar:**
```
src/
├── model/
│   └── sidebar.bindings.ts         Domain state → component props mapping
├── api/
│   └── use-sidebar.ts              useService + useStream wiring
├── ui/
│   ├── SidebarFeature.tsx          Thin composition (10-20 lines)
│   └── SidebarFeature.stories.tsx
└── index.ts
```

**ui.page.main:**
```
src/
├── ui/
│   ├── MainPage.tsx                AppShell template + features in compound slots
│   └── MainPage.stories.tsx
└── index.ts                        PUBLIC — imported by app
```

---

## 4. Ports & Adapters

### 4.1 Ports (in core.shared)

Ports are `Context.Tag` definitions — the contracts that adapters implement and features depend on:

```typescript
// core.shared/src/model/ports.ts

export class DatabaseService extends Context.Tag("DatabaseService")<DatabaseService, {
  readonly query: <A>(f: (db: DB) => Promise<A>) => Effect<A, DatabaseError>
  readonly transaction: <A>(f: (db: DB) => Promise<A>) => Effect<A, DatabaseError>
}>() {}

export class TabRepository extends Context.Tag("TabRepository")<TabRepository, {
  readonly getAll: () => Effect<Tab[], DatabaseError>
  readonly create: (url: string) => Effect<Tab, DatabaseError>
  readonly remove: (id: string) => Effect<void, DatabaseError>
  readonly update: (id: string, data: Partial<Tab>) => Effect<void, DatabaseError>
  readonly getActive: () => Effect<Tab | undefined, DatabaseError>
  readonly setActive: (id: string) => Effect<void, DatabaseError>
}>() {}

// Note: TelemetryService and TransportService ports are NOT defined here.
// Telemetry is provided via @effect/opentelemetry Layer (no port needed — spans are automatic).
// Transport is handled by @effect/rpc (no port needed — client/server are auto-generated).
// Only domain-specific ports belong in core.shared. Infrastructure is configured in adapters.
```

### 4.2 Adapters (in domain.adapter.*)

Adapters implement ports. They are the ONLY place where third-party infrastructure libraries appear:

```typescript
// domain.adapter.turso/src/api/tab.repository.ts

import { TabRepository } from "@ctrl/core.shared"
import { tabsTable } from "../model/tabs.schema"
import { makeRepository } from "../lib/make-repository"

const baseRepo = makeRepository(tabsTable)

export const TabRepositoryLive = Layer.effect(TabRepository,
  Effect.gen(function*() {
    const sql = yield* SqlDrizzle
    const base = baseRepo(sql)
    return {
      ...base,
      getActive: () => sql
        .select().from(tabsTable)
        .where(eq(tabsTable.isActive, true))
        .pipe(Effect.map(rows => rows[0]))
    }
  })
)
```

### 4.3 Drizzle + @effect/sql-drizzle

Drizzle lives entirely inside `domain.adapter.turso`. Nothing outside the adapter knows it exists.

- **Schema definitions** — Drizzle `sqliteTable()` in `model/`
- **Query execution** — `@effect/sql-drizzle` for Effect-native Drizzle
- **Migrations** — `drizzle-kit generate` from schema changes
- **Type mapping** — adapter maps Drizzle rows to domain types defined in `core.shared`

```typescript
// core.shared/src/model/types.ts — CANONICAL domain types (manually defined)
export interface Tab {
  id: string
  url: string
  title: string | null
  position: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// domain.adapter.turso/src/model/tabs.schema.ts — Drizzle schema (must match domain types)
export const tabsTable = sqliteTable("tabs", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  position: integer("position").notNull().default(0),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(false),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
})

// Use satisfies to verify schema matches domain type at compile time:
type _Check = typeof tabsTable.$inferSelect satisfies Tab
```

Domain types live in `core.shared` (no adapter dependency). The Drizzle schema is validated against domain types via `satisfies` — if they drift, the compiler catches it.

### 4.4 The Hex Flow

```
core.shared          ports (interfaces) + domain types
                          ↑                    ↑
domain.adapter.*          │     domain.feature.*
   implements port ───────┘     depends on port (via DI, never direct import)
```

Features point inward to ports. Adapters point inward to ports. They never see each other. The composition root (in `packages/apps/*/layers.ts`) is the only place that wires adapter to feature.

---

## 5. Reactivity & Data Flow

### 5.1 Reactive Primitive

**Effect `PubSub` → `Stream` across all layers.** No custom reactivity system. SolidJS signals appear only at the final UI boundary via a single `useStream` utility.

### 5.2 Mutation Flow (tab creation)

```
ui.feature.sidebar          user clicks "+"
        │
        │  yield* BrowsingService.createTab(url)
        ▼
domain.service.browsing     orchestrates features
        │
        │  yield* TabFeature.create(url)
        │  yield* HistoryFeature.record(url)
        ▼
domain.feature.tab          atomic logic + reactivity
        │
        │  yield* TabRepository.create(url)    ← persist
        │  yield* PubSub.publish(newState)     ← notify
        ▼
domain.adapter.turso        Drizzle executes query
```

### 5.3 Reactivity Flow (state update reaching UI)

```
domain.feature.tab          PubSub.publish(newState)
        │
        │  Stream.fromPubSub(pubsub)
        ▼
domain.service.browsing     subscribes to feature streams
        │                   composes into Stream<BrowsingState>
        │
        │  @effect/rpc streams over Electrobun RPC
        ▼
ui.feature.sidebar          useStream(service.changes)
        │                   Stream<BrowsingState> → SolidJS Accessor
        ▼
core.ui Sidebar             receives props, renders
```

### 5.4 Feature Service with PubSub

Each `domain.feature.*` owns its PubSub. Reactivity is built into the service:

```typescript
// domain.feature.tab/src/api/tab.service.ts

const TabFeatureLive = Layer.effect(TabFeature,
  Effect.gen(function*() {
    const repo = yield* TabRepository
    const pubsub = yield* PubSub.unbounded<Tab[]>()

    const notify = () =>
      repo.getAll().pipe(
        Effect.flatMap((tabs) => PubSub.publish(pubsub, tabs)),
        Effect.withSpan("TabFeature.notify")
      )

    return {
      getAll: () => repo.getAll().pipe(Effect.withSpan("TabFeature.getAll")),

      create: (url: string) =>
        repo.create(url).pipe(
          Effect.tap(() => notify()),
          Effect.withSpan("TabFeature.create")
        ),

      remove: (id: string) =>
        repo.remove(id).pipe(
          Effect.tap(() => notify()),
          Effect.withSpan("TabFeature.remove")
        ),

      changes: Stream.fromPubSub(pubsub),
    }
  })
)
```

### 5.5 Composed Service Streams

`domain.service.*` subscribes to feature streams and composes them:

```typescript
// domain.service.browsing/src/api/browsing.service.ts

const BrowsingServiceLive = Layer.effect(BrowsingService,
  Effect.gen(function*() {
    const tabs = yield* TabFeature
    const history = yield* HistoryFeature

    return {
      createTab: (url: string) =>
        Effect.gen(function*() {
          yield* tabs.create(url)
          yield* history.record(url)
        }).pipe(Effect.withSpan("BrowsingService.createTab")),

      // combineLatest: emits when EITHER stream updates (not zip which waits for both)
      changes: Stream.combineLatest(tabs.changes, history.changes).pipe(
        Stream.map(([tabs, history]) => ({ tabs, history }))
      ),
    }
  })
)
```

### 5.6 UI Bridge Utilities

Three utilities in `core.ui` bridge Effect services to SolidJS:

**`useRuntime` — provides the Effect ManagedRuntime via SolidJS context:**

The app's composition root creates a `ManagedRuntime` from the Layer stack and provides it via SolidJS context. All bridge utilities consume it.

```typescript
// core.ui/src/lib/runtime-provider.ts

const RuntimeContext = createContext<ManagedRuntime<AppLayer>>()

export function RuntimeProvider(props: ParentProps<{ runtime: ManagedRuntime<AppLayer> }>) {
  return (
    <RuntimeContext.Provider value={props.runtime}>
      {props.children}
    </RuntimeContext.Provider>
  )
}

export function useRuntime() {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new Error("RuntimeProvider not found")
  return runtime
}
```

**`useStream` — converts Effect Stream to SolidJS signal:**

```typescript
// core.ui/src/lib/use-stream.ts

export function useStream<A>(stream: Stream<A>, initial: A): Accessor<A> {
  const [value, setValue] = createSignal(initial)
  const runtime = useRuntime()
  const owner = getOwner()  // capture SolidJS reactive owner

  onMount(() => {
    const fiber = runtime.runFork(
      stream.pipe(Stream.runForEach((a) =>
        Effect.sync(() => runWithOwner(owner, () => setValue(() => a)))
      ))
    )
    onCleanup(() => runtime.runFork(Fiber.interrupt(fiber)))
  })

  return value
}
```

Note: `runWithOwner` ensures signal updates happen within SolidJS's reactive ownership tree, preventing issues with high-frequency updates from Effect fibers.

**`useService` — resolves a service from the Effect runtime:**

```typescript
// core.ui/src/lib/use-service.ts

export function useService<I, S>(tag: Context.Tag<I, S>): S {
  const runtime = useRuntime()
  return runtime.runSync(Effect.service(tag))
}
```

### 5.7 @effect/rpc — Transport Agnostic

`@effect/rpc` makes the process boundary invisible. Services are defined as Effect Schema requests. The client proxy is auto-generated:

- **Bun process:** RPC server serves BrowsingService (real implementation)
- **Webview process:** RPC client provides BrowsingService (auto-generated proxy)
- **Same code, same types** — `yield* BrowsingService.createTab(url)` works identically in both

Streaming requests (like `changes`) work over RPC natively — Effect `Stream` serializes across the transport.

### 5.8 Future DBSP Swap Point

When Turso DBSP stabilizes, the swap is minimal:

```typescript
// Today: manual notify after mutation
changes: Stream.fromPubSub(pubsub)
create: (url) => repo.create(url).pipe(Effect.tap(() => notify()))

// Future: Turso DBSP pushes changes
changes: db.subscribe("SELECT * FROM tabs")  // replaces PubSub
// create() drops notify() — DB subscription handles it
```

Same `Stream<Tab[]>` interface. All consumers unchanged.

---

## 6. Codegen Reduction — Factories

Three factories + one hook eliminate ~70% of boilerplate:

### 6.1 makeRepository — CRUD from Drizzle schema

```typescript
// domain.adapter.turso/src/lib/make-repository.ts

export const makeRepository = <T extends SQLiteTable>(table: T) => (db: DrizzleClient) => ({
  getAll: () => db.select().from(table).pipe(Effect.withSpan(`${table._.name}.getAll`)),
  getById: (id: string) =>
    db.select().from(table).where(eq(table.id, id)).pipe(Effect.withSpan(`${table._.name}.getById`)),
  create: (values: typeof table.$inferInsert) =>
    db.insert(table).values(values).pipe(Effect.withSpan(`${table._.name}.create`)),
  update: (id: string, values: Partial<typeof table.$inferInsert>) =>
    db.update(table).set(values).where(eq(table.id, id)).pipe(Effect.withSpan(`${table._.name}.update`)),
  remove: (id: string) =>
    db.delete(table).where(eq(table.id, id)).pipe(Effect.withSpan(`${table._.name}.remove`)),
})
```

**Usage:** spread factory + add custom queries only:

```typescript
const base = makeRepository(tabsTable)
export const tabRepository = (db) => ({
  ...base(db),
  getActive: () => db.select().from(tabsTable).where(eq(tabsTable.isActive, true)),
})
```

### 6.2 makeFeatureService — Service + PubSub from repository

```typescript
// shared factory pattern (can live in core.shared or be inline)

const makeFeatureService = <T, I, S>(
  serviceTag: Context.Tag<I, S>,
  repoTag: Context.Tag<string, Repository<T>>,
  serviceName: string,
) => Layer.effect(serviceTag,
  Effect.gen(function*() {
    const repo = yield* repoTag
    const pubsub = yield* PubSub.unbounded<T[]>()

    const notify = () => repo.getAll().pipe(
      Effect.flatMap((items) => PubSub.publish(pubsub, items)),
      Effect.withSpan(`${serviceName}.notify`)
    )

    return {
      getAll: () => repo.getAll().pipe(Effect.withSpan(`${serviceName}.getAll`)),
      create: (input) => repo.create(input).pipe(
        Effect.tap(() => notify()),
        Effect.withSpan(`${serviceName}.create`)
      ),
      remove: (id) => repo.remove(id).pipe(
        Effect.tap(() => notify()),
        Effect.withSpan(`${serviceName}.remove`)
      ),
      changes: Stream.fromPubSub(pubsub),
    }
  })
)
```

### 6.3 useDomainService — UI binding from service

```typescript
// core.ui/src/lib/use-domain-service.ts

export function useDomainService<I, A extends { changes: Stream<any> }>(tag: Context.Tag<I, A>) {
  const service = useService(tag)
  const data = useStream(service.changes, undefined)
  return { data, actions: service }
}
```

**Usage in ui.feature.sidebar (the ENTIRE binding):**

```typescript
export function SidebarFeature() {
  const { data: state, actions } = useDomainService(BrowsingService)
  const sidebar = useSidebar()  // Zag FSM from core.ui

  return (
    <Sidebar api={sidebar}>
      <Sidebar.Rail>
        {state()?.tabs.map(tab => <TabItem tab={tab} />)}
      </Sidebar.Rail>
    </Sidebar>
  )
}
```

### 6.4 What Remains Manual

| What | Manual? | How much |
|------|---------|----------|
| Drizzle table schema | **yes** | Source of truth |
| Custom queries (beyond CRUD) | **yes** | Only non-standard queries |
| Custom business rules | **yes** | The actual logic |
| Complex service orchestration | **yes** | Only `domain.service.*` with real composition |
| UI layout/composition | **yes** | `ui.page.*` arranging features |
| Component design | **yes** | `core.ui` atoms/molecules/organisms/templates |
| TypeScript types | **no** | Inferred from Drizzle schema |
| CRUD repository | **no** | `makeRepository` factory |
| Migrations | **no** | `drizzle-kit generate` |
| PubSub + Stream reactivity | **no** | `makeFeatureService` factory |
| RPC client/server | **no** | `@effect/rpc` auto-generates |
| UI service binding | **no** | `useDomainService` hook |

---

## 7. GritQL Boundary Enforcement

### 7.1 Dependency Rules

```grit
// ui.* cannot import domain.feature.* or domain.adapter.*
`import { $_ } from "@ctrl/domain.feature.$_"` where {
  $filename <: within `ui.`
} => error("ui.* can only import domain.service.*")

`import { $_ } from "@ctrl/domain.adapter.$_"` where {
  $filename <: within `ui.`
} => error("ui.* can only import domain.service.*")

// app can only import ui.page.*
`import { $_ } from "@ctrl/ui.feature.$_"` where {
  $filename <: within `apps/`
} => error("apps can only import ui.page.*")

// domain.feature.* cannot import domain.service.*
`import { $_ } from "@ctrl/domain.service.$_"` where {
  $filename <: within `domain.feature.`
} => error("domain.feature.* cannot import domain.service.*")

// domain.feature.* cannot import domain.adapter.* (uses ports via DI)
`import { $_ } from "@ctrl/domain.adapter.$_"` where {
  $filename <: within `domain.feature.`
} => error("domain.feature.* depends on ports, not adapters")

// domain.service.* cannot import domain.adapter.*
`import { $_ } from "@ctrl/domain.adapter.$_"` where {
  $filename <: within `domain.service.`
} => error("domain.service.* composes features, not adapters — use DI via Layer")

// domain.service.* cannot import other domain.service.* packages
`import { $_ } from "@ctrl/domain.service.$_"` where {
  $filename <: within `domain.service.`
} => error("domain.service.* composes features, not other services — no service-to-service deps")

// domain.adapter.* cannot import domain.feature.* or domain.service.*
`import { $_ } from "@ctrl/domain.feature.$_"` where {
  $filename <: within `domain.adapter.`
} => error("adapters implement ports, they don't import features")

// domain.adapter.* cannot import other domain.adapter.* packages
`import { $_ } from "@ctrl/domain.adapter.$_"` where {
  $filename <: within `domain.adapter.`
} => error("adapters are independent — they don't import each other")

// core.* cannot import domain.* or ui.*
`import { $_ } from "@ctrl/domain.$_"` where {
  $filename <: within `core.`
} => error("core.* is foundation — no domain imports")

`import { $_ } from "@ctrl/ui.$_"` where {
  $filename <: within `core.`
} => error("core.* is foundation — no ui imports")
```

### 7.2 No Peer Imports (same-tier isolation)

Packages within the same tier cannot import each other. Each package is independent at its tier:

```grit
// domain.feature.* cannot import other domain.feature.* packages
`import { $_ } from "@ctrl/domain.feature.$_"` where {
  $filename <: within `domain.feature.`
} => error("domain.feature.* packages are atomic — no cross-feature imports")

// domain.service.* cannot import other domain.service.* packages (already in 7.1)

// domain.adapter.* cannot import other domain.adapter.* packages (already in 7.1)

// ui.feature.* cannot import other ui.feature.* packages
`import { $_ } from "@ctrl/ui.feature.$_"` where {
  $filename <: within `ui.feature.`
} => error("ui.feature.* packages are atomic — no cross-feature imports")

// ui.page.* cannot import other ui.page.* packages
`import { $_ } from "@ctrl/ui.page.$_"` where {
  $filename <: within `ui.page.`
} => error("ui.page.* packages are independent — no cross-page imports")
```

**The rule:** no package imports a peer at the same tier. Composition happens one level up — features compose in services, UI features compose in pages, pages compose in the app.

### 7.3 FSD Segment Rules

```grit
// model/ never imports from api/
`import { $_ } from "../api/$_"` where {
  $filename <: within `model/`
} => error("model/ cannot import from api/ — models are dependencies, not dependents")

// lib/ must be pure — no Effect service imports
`yield* $_` where {
  $filename <: within `lib/`
} => error("lib/ must be pure — no Effect services, use api/ for service code")

// index.ts only re-exports — no logic
// (enforced by code review convention, not easily GritQL-able)
```

---

## 8. Telemetry & Testing Strategy

### 8.1 Approach

**Approach B — trace assertions embedded in tests.** No external services (Jaeger, Grafana) required for development. Tests capture OTEL spans in-memory via `TestSpanExporter` and assert on them.

### 8.2 OTEL Setup

`domain.adapter.otel` provides the telemetry Layer:

```typescript
// Production Layer
const OtelLive = NodeSdk.layer(() => ({
  resource: { serviceName: "ctrl.page.main" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter())
}))

// Test Layer (captures spans in-memory)
const TestOtelLive = TestSpanExporter.layer
```

Both Bun and webview processes get the OTEL Layer — same `domain.adapter.otel` package, different runtime configurations in each composition root.

Every Effect operation uses `Effect.withSpan(name)` for automatic tracing.

### 8.3 Four Testing Levels

| Level | What it verifies | Where it lives | Runs in CI? |
|-------|------------------|----------------|-------------|
| **L1: Unit test** | Single service logic, validation, pure functions | `domain.feature.*/api/*.test.ts`, `model/*.test.ts`, `lib/*.test.ts` | Yes |
| **L2: Trace assertion** | Data flows correctly across service boundaries | `domain.service.*/api/*.test.ts` | Yes |
| **L3: Story interaction** | UI renders and responds to user actions | `ui.feature.*/ui/*.stories.tsx` | Yes (Storybook) |
| **L4: Pipeline trace** | Full e2e flow from entry to DB and back via streams | `packages/apps/*/test/pipeline.test.ts` | Yes |

### 8.4 Level 1 — Unit Tests

Every `domain.feature.*` has unit tests with mocked ports:

```typescript
// domain.feature.tab/src/api/tab.service.test.ts

const MockRepo = Layer.succeed(TabRepository, {
  getAll: () => Effect.succeed([mockTab]),
  create: (url) => Effect.succeed({ id: "1", url, title: "" }),
  remove: (id) => Effect.succeed(void 0),
})

const TestLayer = TabFeatureLive.pipe(Layer.provide(MockRepo))

describe("TabFeature", () => {
  it("create publishes to stream", () =>
    Effect.gen(function*() {
      const tab = yield* TabFeature
      const fiber = yield* tab.changes.pipe(
        Stream.take(1), Stream.runCollect, Effect.fork
      )
      yield* tab.create("https://example.com")
      const collected = yield* Fiber.join(fiber)
      expect(Chunk.toArray(collected)).toHaveLength(1)
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  )
})
```

### 8.5 Level 2 — Trace Assertions

Every `domain.service.*` has trace assertions that verify boundary crossing:

```typescript
// domain.service.browsing/src/api/browsing.service.test.ts

const TestLayer = BrowsingServiceLive.pipe(
  Layer.provide(TabFeatureLive),
  Layer.provide(HistoryFeatureLive),
  Layer.provide(MockRepo),
  Layer.provide(TestSpanExporter.layer),
)

describe("BrowsingService traces", () => {
  it("createTab traces full flow", () =>
    Effect.gen(function*() {
      const browsing = yield* BrowsingService
      const exporter = yield* TestSpanExporter

      yield* browsing.createTab("https://example.com")

      const spans = exporter.getFinishedSpans()
      expect(spans).toContainSpan("BrowsingService.createTab")
      expect(spans).toContainSpan("TabFeature.create")
      expect(spans).toContainSpan("TabRepository.create")
      expect(spans).toContainSpan("HistoryFeature.record")
      expect(spans).toContainSpan("TabFeature.notify")

      // verify parent-child chain is unbroken
      const root = spans.find(s => !s.parentSpanId)
      expect(root?.name).toBe("BrowsingService.createTab")

      // verify zero errors
      expect(spans.every(s => s.status.code === SpanStatusCode.OK)).toBe(true)
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  )
})
```

### 8.6 Level 3 — Story Interaction Tests

Every `ui.feature.*` has Storybook stories with play functions:

```typescript
// ui.feature.sidebar/src/ui/SidebarFeature.stories.tsx

export const CreateTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "New tab" }))
    await waitFor(() => {
      expect(canvas.getAllByRole("tab")).toHaveLength(2)
    })
  }
}
```

### 8.7 Level 4 — Full Pipeline Trace

Integration tests in `packages/apps/*/test/` wire up the full Layer stack with only DB and transport mocked:

```typescript
// packages/apps/desktop/src/test/pipeline.test.ts

const PipelineTestLayer = Layer.mergeAll(
  BrowsingServiceLive,
  TabFeatureLive,
  HistoryFeatureLive,
  MockDatabaseServiceLive,    // in-memory SQLite
  MockTransportLive,          // simulates RPC
  TestSpanExporter.layer,
)

describe("Full pipeline", () => {
  it("tab creation flows end-to-end", () =>
    Effect.gen(function*() {
      const browsing = yield* BrowsingService
      const exporter = yield* TestSpanExporter

      // subscribe to stream BEFORE mutation
      const collected = yield* browsing.changes.pipe(
        Stream.take(1), Stream.runCollect, Effect.fork
      )

      yield* browsing.createTab("https://example.com")

      // verify stream delivered data
      const state = yield* Fiber.join(collected)
      expect(Chunk.toArray(state)[0].tabs).toHaveLength(1)

      // verify complete trace chain
      const spans = exporter.getFinishedSpans()
      expect(spans.map(s => s.name)).toEqual(
        expect.arrayContaining([
          "BrowsingService.createTab",
          "TabFeature.create",
          "TabRepository.create",
          "TabFeature.notify",
          "PubSub.publish",
          "HistoryFeature.record",
        ])
      )

      // verify unbroken parent-child chain
      const root = spans.find(s => !s.parentSpanId)
      expect(root?.name).toBe("BrowsingService.createTab")
      const orphans = spans.filter(s =>
        s !== root && !spans.some(p => p.spanId === s.parentSpanId)
      )
      expect(orphans).toHaveLength(0)

      // verify zero errors
      expect(spans.filter(s => s.status.code === SpanStatusCode.ERROR)).toHaveLength(0)
    }).pipe(Effect.provide(PipelineTestLayer), Effect.runPromise)
  )
})
```

### 8.8 What Each Level Catches

| Bug type | L1 unit | L2 trace | L3 story | L4 pipeline |
|----------|---------|----------|----------|-------------|
| Wrong business logic | ✓ | | | |
| Missing service call | | ✓ | | ✓ |
| Broken Layer wiring | | | | ✓ |
| Stream never delivers | | partial | | ✓ |
| Error swallowed silently | | | | ✓ |
| Orphan spans (broken trace propagation) | | | | ✓ |
| Performance regression (span durations) | | | | ✓ |
| UI doesn't react to state change | | | ✓ | |

### 8.9 Vitest Configuration

```typescript
// vitest.config.ts (root)
export default defineConfig({
  test: {
    include: ["packages/libs/**/src/**/*.test.ts", "packages/apps/**/src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/libs/**/src/**/api/**", "packages/libs/**/src/**/model/**"],
    },
  },
})
```

### 8.10 Agent Development Loop

```
Agent writes code
  → runs Level 1 (unit tests) — logic correct?
  → runs Level 4 (pipeline trace) — wiring correct?
  → both pass → code is ready
  → pipeline fails → trace shows EXACTLY which boundary broke
```

---

## 9. core.ui Templates (Deferred)

Compound component pattern + CSS container queries for scalable responsive layouts. Detailed spec to follow in a dedicated session. Key decisions made:

- Templates use compound components: `AppShell.Sidebar`, `AppShell.Content`, etc.
- Every sva slot maps 1:1 to a compound sub-component
- Template slots declare `containerType: "inline-size"` for CSS container queries
- Components inside slots adapt via `@container` queries — no JS layout logic
- Three mechanisms: discrete modes (sva variants), continuous adaptation (container queries), interactive resize (Zag machines)
- Pattern applies to organisms and molecules too, not just templates

---

## 10. Implementation Strategy

**Approach B — Vertical Slice.**

Migrate the existing `feature.sidebar-tabs` POC through the new architecture as the first slice:

1. Scaffold all packages with correct naming + GritQL rules
2. Implement adapter → feature → service → UI for tabs (parallel where possible)
3. Wire end-to-end, pipeline trace assertions pass
4. Build all three factories from the working code
5. Replicate with a second feature (bookmarks) to validate factories
6. Both features passing all four test levels → architecture validated

With Claude Max (Opus 4.6, 1M context), steps 1–6 can be completed in a single implementation session.

---

## 11. Dependencies

| Package | Key dependencies |
|---------|------------------|
| `core.shared` | `effect`, `@effect/schema` |
| `core.ui` | `effect`, `solid-js`, `@pandacss/dev`, `@zag-js/solid` |
| `domain.adapter.turso` | `@effect/sql-drizzle`, `@effect/sql-libsql`, `drizzle-orm` |
| `domain.adapter.otel` | `@effect/opentelemetry`, `@opentelemetry/sdk-trace-node` |
| `domain.adapter.rpc` | `@effect/rpc`, `@effect/rpc-http` |
| `domain.feature.*` | `effect` (+ `core.shared` ports) |
| `domain.service.*` | `effect` (+ `domain.feature.*`) |
| `ui.feature.*` | `solid-js`, `@ctrl/core.ui`, `@ctrl/domain.service.*` |
| `ui.page.*` | `solid-js`, `@ctrl/core.ui`, `@ctrl/ui.feature.*` |

**Test dependencies (devDependencies):**
- `vitest` — test runner
- `@opentelemetry/sdk-trace-base` — `InMemorySpanExporter` for test trace capture
- `@storybook/test` — interaction test utilities

**Note:** `TestSpanExporter` referenced in test examples is a custom wrapper around `InMemorySpanExporter` from `@opentelemetry/sdk-trace-base`, provided by `domain.adapter.otel` as a test utility. The `toContainSpan` matcher is a custom Vitest matcher defined in the test setup. Both are implemented as part of the `domain.adapter.otel` package.

---

## 12. Documentation Deliverables

This architecture must be documented and enforced:

| Deliverable | Location | Purpose |
|-------------|----------|---------|
| This spec | `docs/superpowers/specs/2026-03-14-domain-architecture-design.md` | Architecture reference |
| Package naming guide | `docs/architecture/package-naming.md` | How to name new packages |
| FSD segments guide | `docs/architecture/fsd-segments.md` | How to structure code inside packages |
| Dependency matrix | `docs/architecture/dependency-matrix.md` | What can import what (with examples) |
| GritQL rules | `.grit/` | Automated boundary enforcement |
| Factory API docs | Inline JSDoc in `makeRepository`, `makeFeatureService`, `useDomainService` | Usage examples for agent and human |
| Testing guide | `docs/architecture/testing-strategy.md` | Four levels, when to use each, trace assertion patterns |
| CLAUDE.md update | `CLAUDE.md` | Agent instructions referencing the above docs |

---

## 13. Migration Path

### Current → New

| Current package | Becomes |
|-----------------|---------|
| `core.db` | `domain.adapter.turso` (schema, repository, migrations) |
| `core.shared` | `core.shared` (add ports, keep types) |
| `core.ui` | `core.ui` (add `useStream`, `useService`, templates) |
| `feature.sidebar-tabs` | Split into: `domain.feature.tab` + `domain.service.browsing` + `ui.feature.sidebar` + `ui.page.main` |
| `core.otel` (new) | `domain.adapter.otel` |
| RPC in `apps/desktop` | Extract to `domain.adapter.rpc` |

### Packages to Remove After Migration

- `core.db` — replaced by `domain.adapter.turso`
- `feature.sidebar-tabs` — replaced by domain + ui packages
