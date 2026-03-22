# Event-Driven Architecture v2 Design

> Supersedes: `2026-03-22-event-driven-architecture-design.md`
> This spec covers the full architectural evolution: core restructure, event-driven model, Mastra agent integration, and typed API client.

## Problem

Current architecture has:
- **Fragmented communication**: IPC (fire-and-forget), RPC (request/response), per-feature PubSub, scattered UI ops
- **Fat controllers**: features contain business logic + EventBus wiring + IO — no separation of concerns
- **Three sources of truth**: Effect Schema, Drizzle tables, and manual repository glue code (195+ lines per repo)
- **No agent integration**: no framework for AI agents to participate as first-class citizens
- **Boilerplate**: adding a new operation requires 5-9 file changes across 3-4 packages
- **Rigid coupling**: services can't compose, agent/extension model impossible without universal command interface

## Solution

Introduce a **typed event-driven architecture** where:
1. **EventBus** is the single communication layer — all commands and events flow through it
2. **Model.Class** (`@effect/sql`) is the single source of truth for data — generates schemas, repos, and API types
3. **RpcGroup** (`@effect/rpc`) or **EventGroup** (`@effect/experimental`) provides typed client + exhaustive handlers from a single definition
4. **Mastra** embeds as an adapter for AI agent capabilities
5. **core.ui.api** gives UI a typed, reactive, zero-boilerplate client

## Architecture

### Core Package Levels

a-z naming convention: alphabetically earlier = lower level = fewer deps. Each level can only import levels above it (lower in sort order).

```
Level 0: core.base.*      (b) → foundational: model, types, tracing, errors
Level 1: core.port.*      (p) → interfaces: event-bus (+ signals), storage, agent-runtime
Level 2: core.ui.*        (u) → UI: api, design, widgets

b < p < u
```

Packages within the same level are flat peers — they do not import each other.

#### core.base.* (Level 0)

| Package | Contents |
|---------|----------|
| `core.base.model` | `Model.Class` definitions — Session, Bookmark, HistoryEntry, Agent, etc. Single source of truth for data shapes. |
| `core.base.types` | Branded IDs (`SessionId`, `AgentId`, `BookmarkId`), shared literals, enums |
| `core.base.tracing` | `withTracing()`, `spanName()`, `withWebTracing()` |
| `core.base.errors` | Generic error classes (`DatabaseError`, `ValidationError`) — only if not port-specific |

Introduce new `core.base.*` packages only when content is specific enough to warrant separation. Start with `model`, `types`, `tracing`.

#### core.port.* (Level 1)

| Package | Contents |
|---------|----------|
| `core.port.event-bus` | `EventBus` Context.Tag (transport) + **all signal definitions** (commands, events, typed payloads). Imports `core.base.model` for payload types. |
| `core.port.storage` | Repository Context.Tags (`SessionRepository`, `BookmarkRepository`, etc.) |
| `core.port.agent-runtime` | `AgentRuntime` Context.Tag — generate, stream, workflows, tools, memory |

Signals (commands + events) live inside `core.port.event-bus` because they are the contract of the bus — inseparable from the transport.

#### core.ui.* (Level 2)

| Package | Contents |
|---------|----------|
| `core.ui.api` | Typed EventBus client for SolidJS: `<ApiProvider>`, `useApi()`, auto-cleanup, reactive signals. Imports `core.port.event-bus` for signal definitions. |
| `core.ui.design` | Design tokens, CSS variables, themes |
| `core.ui.widgets` | Components: atoms, molecules, organisms, templates. `.pen` design files live alongside components. |

### Domain Layer

a-z within domain: adapter(a) < feature(f) < service(s).

```
domain.adapter.*   (a) → port implementations, no EventBus knowledge
domain.feature.*   (f) → atomic business logic, no EventBus knowledge
domain.service.*   (s) → EventBus orchestrator, cross-domain wiring
```

#### domain.adapter.*

| Package | Role |
|---------|------|
| `domain.adapter.db` | Implements `core.port.storage` via Drizzle + LibSQL + `Model.makeRepository` |
| `domain.adapter.mastra` | Implements `core.port.agent-runtime` via Mastra. Effect bridge (`Effect.promise()`), EventBus bridge, Standard Schema interop. |
| `domain.adapter.otel` | OpenTelemetry tracing |

**Removed:**
- `domain.adapter.rpc` — replaced by EventBus carrier inside `domain.service.system`
- `domain.adapter.electrobun` — absorbed into `domain.service.system`

#### domain.feature.*

Pure business logic. No EventBus, no signals. Only knows `core.base.model` and ports via DI.

```typescript
// domain.feature.session — example
import { Session } from "@ctrl/core.base.model"
import { SessionRepository } from "@ctrl/core.port.storage"

const create = (params: { mode: SessionMode }) =>
  Effect.gen(function* () {
    const repo = yield* SessionRepository
    const session = makeSession(params)
    yield* repo.save(session)
    return session
  })
```

Features can use multiple ports (2-3 repositories is normal for cross-table domain logic).

| Package | Domain |
|---------|--------|
| `domain.feature.session` | Session CRUD + business rules |
| `domain.feature.bookmark` | Bookmark CRUD |
| `domain.feature.history` | History recording |
| `domain.feature.omnibox` | URL resolution (search vs navigate) |
| `domain.feature.layout` | Workspace layout state |
| `domain.feature.panel` | Panel state |
| `domain.feature.agent` | Agent orchestration logic |

#### domain.service.*

EventBus orchestrators. The **only** layer with access to the bus. Listens to commands, calls features, publishes events. Cross-domain logic lives here.

```typescript
// domain.service.browsing — example
import { SESSION_CREATE, EVT_SESSION_CREATED } from "@ctrl/core.port.event-bus"

bus.on(SESSION_CREATE).pipe(
  Stream.runForEach((cmd) =>
    feature.session.create(cmd.payload).pipe(
      Effect.tap((session) =>
        bus.publish({ name: EVT_SESSION_CREATED, payload: session })
      )
    )
  )
)

// Cross-domain: bookmark added → update agent memory
bus.on(EVT_BOOKMARK_ADDED).pipe(
  Stream.runForEach((evt) =>
    feature.agent.updateMemory(evt.payload)
  )
)
```

| Package | Responsibility |
|---------|---------------|
| `domain.service.browsing` | Session + navigation + bookmark + history orchestration |
| `domain.service.workspace` | Layout + panel orchestration |
| `domain.service.system` | **All Electrobun interaction**: webview lifecycle, window management, shortcuts, native dialogs, clipboard, notifications, AND EventBus ↔ IPC carrier (transport). Single point of contact with native APIs. |
| `domain.service.agent` | Agent lifecycle, Mastra orchestration, MCP |

### UI Layer

```
ui.feature.*    (f) → wire signals → components
ui.scene.*      (s) → flat atomic scene compositions
```

**Removed:**
- `ui.adapter.electrobun` — replaced by EventBus commands via `core.ui.api`
- `ui.adapter.dockview` — absorbed into `ui.feature.workspace`
- `ui.scenes` (monolith) — replaced by flat `ui.scene.*`

| Package | Role |
|---------|------|
| `ui.feature.sidebar` | Sidebar, session list |
| `ui.feature.workspace` | Workspace layout rendering (includes Dockview bindings) |
| `ui.feature.notifications` | NotificationProvider, useNotifications() |
| `ui.scene.browser` | Main browser scene |
| `ui.scene.settings` | Settings scene |
| `ui.scene.agent` | Agent dashboard scene |

### Apps Layer

```
apps/desktop    → composition root: Layer.provide all adapters + services
```

Wires everything together. No business logic, no EventBus listening — pure DI composition.

## Single Source of Truth: Model.Class

`@effect/sql` `Model.Class` replaces both Effect Schema and Drizzle table definitions:

```typescript
// core.base.model/src/session.ts
import { Model } from "@effect/sql"
import { Schema } from "effect"
import { SessionId } from "@ctrl/core.base.types"

class Session extends Model.Class<Session>("Session")({
  id: Model.GeneratedByApp(SessionId),
  mode: Schema.Literal("visual"),
  isActive: Model.BooleanFromNumber,
  currentIndex: Schema.Number,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}
```

Auto-generated variants:
- `Session` — full type (select)
- `Session.insert` — insert type (no id, no createdAt)
- `Session.update` — update type (with id, auto updatedAt)
- `Session.json` / `Session.jsonCreate` / `Session.jsonUpdate` — API-facing

Repository from one line:
```typescript
// domain.adapter.db
const base = Model.makeRepository(Session, {
  tableName: "sessions",
  spanPrefix: "SessionRepository",
  idColumn: "id",
})
// → insert, insertVoid, update, updateVoid, findById, delete — typed, traced
```

Custom domain methods via `SqlSchema`:
```typescript
const getAll = SqlSchema.findAll({
  Request: Schema.Void,
  Result: Session,
  execute: () => sql`SELECT * FROM sessions ORDER BY createdAt ASC`,
})
```

**Note:** Drizzle table definitions are still needed for `drizzle-kit generate` (migrations). This is the one remaining duplication.

## Typed EventBus: Signals + Client

### Signal Definitions

Signals live in `core.port.event-bus`, organized by domain:

```typescript
// core.port.event-bus/src/signals/session.ts
import { Session } from "@ctrl/core.base.model"

export const SessionSignals = {
  commands: {
    create: Op.command("session.create", Session.insert),
    close: Op.command("session.close", Schema.Struct({ id: Session.fields.id })),
    activate: Op.command("session.activate", Schema.Struct({ id: Session.fields.id })),
  },
  events: {
    created: Op.event("session.created", Session),
    closed: Op.event("session.closed", Schema.Struct({ id: Session.fields.id })),
    activated: Op.event("session.activated", Schema.Struct({ id: Session.fields.id })),
  },
}
```

Types flow from `Model.Class` → signals → UI client without duplication.

### Implementation Options

Two viable approaches using existing Effect primitives (no custom builder needed):

**Option A: RpcGroup as Command Bus** (recommended for incremental migration)

```typescript
const SessionBus = RpcGroup.make(
  Rpc.make("session.create", { payload: Session.insert, success: Schema.Void }),
  Rpc.make("session.close", { payload: Schema.Struct({ id: SessionId }), success: Schema.Void }),
  Rpc.make("session.events", { success: SessionEventSchema, stream: true }),
)

// Auto-generated typed client
const client = yield* RpcClient.make(SessionBus)
client.session.create({ mode: "visual" })  // Effect<void>, typed
client.session.events()                     // Stream<SessionEvent>, typed

// Exhaustive handlers
const SessionBusLive = SessionBus.toLayer({
  "session.create": ({ mode }) => /* ... */,
  "session.close": ({ id }) => /* ... */,
  "session.events": () => bus.events.pipe(Stream.filter(isSessionEvent)),
})
```

**Option B: EventGroup + EventLog** (full event sourcing)

```typescript
const SessionEvents = EventGroup.empty
  .add({ tag: "session.created", primaryKey: (p) => p.id, payload: Session, success: Schema.Void })
  .add({ tag: "session.closed", primaryKey: (p) => p.id, payload: Schema.Struct({ id: SessionId }), success: Schema.Void })

const client = yield* EventLog.makeClient(schema)
client("session.created", { id, mode: "visual" })  // typed dispatch

const handlers = EventLog.group(SessionEvents, (h) =>
  h.handle("session.created", ({ payload }) => /* ... */)
   .handle("session.closed", ({ payload }) => /* ... */)
) // exhaustive — TS errors if handler missing
```

Decision on Option A vs B deferred to implementation phase. Both provide typed client + exhaustive handlers from a single definition.

### UI Client (core.ui.api)

```tsx
// Provider — once at root
<ApiProvider transport={carrier}>
  <App />
</ApiProvider>

// In any component — typed, reactive, auto-cleanup
const api = useApi()

api.session.create({ mode: "visual" })       // typed payload
api.session.create({ mode: "wrong" })         // TS error

const [session] = api.session.on.created()    // Signal<Session>, auto-cleanup on unmount
```

- No manual imports of enums or constants
- No Effect wrapping in components
- No manual unsubscribe
- Type errors at compile time when contract changes

## Mastra Integration

### Architecture

```
core.port.agent-runtime/     → AgentRuntime Context.Tag
domain.adapter.mastra/       → Mastra wrapped in Effect Layer
domain.feature.agent/        → pure agent business logic
domain.service.agent/        → EventBus orchestrator for agents
```

### domain.adapter.mastra

```
domain.adapter.mastra/
  src/
    model/
      mastra-config.ts         → config schema
      tool-bridge.ts           → Effect Schema ↔ Standard Schema / Zod interop
    api/
      mastra-instance.ts       → new Mastra({ agents, tools, workflows })
      agent-runtime.live.ts    → implements core.port.agent-runtime
      event-bus-bridge.ts      → Mastra PubSub ↔ EventBus bidirectional bridge
      dev-server.ts            → Hono server for Mastra Studio (dev only, port 4111)
    lib/
      effect-bridge.ts         → Effect.promise() wrappers + withTracing
```

### Key Integration Points

**Effect bridge**: Every Mastra call wrapped in Effect with tracing:
```typescript
const generate = (params: GenerateParams) =>
  Effect.promise(() => mastraAgent.generate(params.prompt, { threadId: params.threadId }))
    .pipe(withTracing(AGENT_ADAPTER, "generate"))
```

**Schema interop**: Both Effect Schema and Zod implement Standard Schema v1 (`@standard-schema/spec`). Use `Schema.standardSchemaV1()` at boundaries.

**EventBus bridge**: Bidirectional — Mastra tools can send commands to EventBus, EventBus events can trigger Mastra agent actions.

**Multi-agent pipelines**: Mastra handles internal agent-to-agent communication natively. Cross-system flows go through EventBus:
```
Agent A (Mastra) → EventBus event → Effect pipeline → EventBus command → Agent B (Mastra)
```

**Dashboard**: Mastra Studio (React SPA) runs as dev-only Hono server on port 4111. Not included in production build.

**LLM provider**: Mastra communicates with Claude API using existing Claude Code subscription.

**License**: Mastra is Apache 2.0 (non-ee portions). Safe for open-source use.

### Layer Composition

```typescript
// apps/desktop/src/bun/layers.ts
const AgentLayer = AgentHandlersLive.pipe(
  Layer.provide(AgentFeatureLive),
  Layer.provide(MastraAdapterLive),
  Layer.provide(EventBusLive),
)

export const DesktopLive = Layer.mergeAll(
  BrowsingLayer,
  WorkspaceLayer,
  SystemLayer,
  AgentLayer,
)
```

## Carrier: EventBus Transport

The carrier is NOT a separate package or concept. It is an internal responsibility of `domain.service.system`.

```
Webview EventBus ←── IPC (Electrobun, typed, serialized) ──→ Bun EventBus
```

Both sides use the same signal definitions from `core.port.event-bus`. Serialization/deserialization is transparent to business code.

## Package Structure: Final

```
packages/libs/
  # Core (Level 0)
  core.base.model/            → Model.Class definitions (single source of truth)
  core.base.types/            → Branded IDs, literals, enums
  core.base.tracing/          → withTracing, spanName

  # Core (Level 1)
  core.port.event-bus/        → EventBus Tag + all signal definitions
  core.port.storage/          → Repository Tags
  core.port.agent-runtime/    → AgentRuntime Tag

  # Core (Level 2)
  core.ui.api/                → Typed EventBus client for SolidJS
  core.ui.design/             → Tokens, themes, CSS
  core.ui.widgets/            → Components + .pen design files

  # Domain
  domain.adapter.db/          → Drizzle + LibSQL + Model.makeRepository
  domain.adapter.mastra/      → Mastra → AgentRuntime port
  domain.adapter.otel/        → OpenTelemetry

  domain.feature.session/     → Session business logic
  domain.feature.bookmark/    → Bookmark logic
  domain.feature.history/     → History logic
  domain.feature.omnibox/     → URL resolution
  domain.feature.layout/      → Layout state
  domain.feature.panel/       → Panel state
  domain.feature.agent/       → Agent logic

  domain.service.browsing/    → Session + nav + bookmark + history orchestration
  domain.service.workspace/   → Layout + panel orchestration
  domain.service.system/      → Electrobun: native APIs + EventBus carrier
  domain.service.agent/       → Agent orchestration + MCP

  # UI
  ui.feature.sidebar/
  ui.feature.workspace/       → includes Dockview bindings
  ui.feature.notifications/

  ui.scene.browser/
  ui.scene.settings/
  ui.scene.agent/

  # Apps
  apps/desktop/               → composition root
```

### Packages Removed
- `core.shared` → split into `core.base.*`
- `core.ports.event-bus` → renamed `core.port.event-bus` (singular)
- `domain.adapter.rpc` → replaced by carrier in `domain.service.system`
- `domain.adapter.electrobun` → absorbed into `domain.service.system`
- `ui.adapter.electrobun` → replaced by EventBus via `core.ui.api`
- `ui.adapter.dockview` → absorbed into `ui.feature.workspace`
- `ui.scenes` (monolith) → flat `ui.scene.*`

### Package Convention
- 3-level naming: `{scope}.{namespace}.{name}` (e.g., `core.base.model`)
- 2-level = namespace, not a package (e.g., `core.base` is a namespace)
- Minimal `package.json` (name + version + type), no per-package tsconfig
- Imports resolved via workspace + root tsconfig paths
- GritQL enforces boundaries by package name

## Migration Strategy

This spec covers a **full migration**, not incremental coexistence. No legacy support needed.

### Phase 1: Core Restructure
1. Create `core.base.model` with Model.Class definitions
2. Create `core.base.types` with branded IDs
3. Create `core.base.tracing` (move from core.shared)
4. Move signal definitions into `core.port.event-bus`
5. Rename `core.ports.*` → `core.port.*` (singular)
6. Split `core.ui` → `core.ui.api`, `core.ui.design`, `core.ui.widgets`
7. Delete `core.shared`

### Phase 2: Domain Restructure
1. Refactor features: remove EventBus wiring, make pure business logic
2. Refactor services: become EventBus orchestrators
3. Create `domain.service.system` (absorb electrobun adapter + carrier + rpc adapter)
4. Refactor `domain.adapter.db` to use `Model.makeRepository`
5. Delete `domain.adapter.rpc`, `domain.adapter.electrobun`

### Phase 3: UI Restructure
1. Build `core.ui.api` — typed EventBus client with SolidJS reactivity
2. Migrate UI features to use `useApi()` instead of RPC hooks
3. Absorb `ui.adapter.dockview` into `ui.feature.workspace`
4. Split `ui.scenes` into flat `ui.scene.*`
5. Delete `ui.adapter.electrobun`, `ui.adapter.dockview`

### Phase 4: Agent Integration
1. Create `core.port.agent-runtime`
2. Create `domain.adapter.mastra` with Effect bridge + EventBus bridge
3. Create `domain.feature.agent`
4. Create `domain.service.agent` with MCP exposure
5. Add agent signals to `core.port.event-bus`
6. Add `ui.scene.agent` for agent dashboard

### Phase 5: Typed Client Finalization
1. Decide between RpcGroup (Option A) vs EventGroup (Option B)
2. Build typed client builder in `core.ui.api`
3. Ensure full type flow: Model.Class → signals → UI client
4. Verify compile-time errors on contract changes

## Success Criteria

- **Single definition**: Model.Class defines data once — used by DB, signals, UI, agents
- **Typed end-to-end**: change a model field → TS errors propagate to all consumers
- **Zero boilerplate UI**: `api.session.create()` — no imports of constants, no Effect wrapping, no manual cleanup
- **Agent as first-class citizen**: agents send commands and receive events identically to UI
- **Exhaustive handlers**: TypeScript errors if a signal handler is missing
- **2-file operation**: adding a new command = 1 signal definition + 1 handler
- **No legacy**: clean migration, no coexistence layer
