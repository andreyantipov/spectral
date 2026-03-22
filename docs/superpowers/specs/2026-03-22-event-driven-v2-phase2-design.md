# Event-Driven v2 Phase 2: EventLog Migration

> Implements Phase 2 of `2026-03-22-event-driven-architecture-v2-design.md`.
> Depends on Phase 1 (PR #11 — core.base.*, core.port.event-bus, core.ui.api).

## Problem

After Phase 1, there are **two paths** for the same operations:

1. **EventBus path** (keyboard shortcuts): Cmd+T → EventBus.send() → command-router.ts → feature → event
2. **RPC path** (UI clicks): SidebarFeature → client.navigate() → BrowsingHandlersLive → feature

This causes regressions — some actions work via keyboard but not UI, or vice versa. Tab management is broken because the two paths have different behavior (e.g., command-router publishes events, RPC handlers don't).

## Solution

**One path**: UI → `useApi()` (core.ui.api) → EventLog → handlers → features → events → UI.

Replace `BrowsingRpcs` (request/response) with `EventGroup` + `EventLog` from `@effect/experimental@0.58.0` (fire-and-forget + subscribe). `Model.Class` remains the single source of truth — EventGroup payloads reference `Session.fields.*` directly.

## Architecture

```
UI (SolidJS)
  └─ useApi()                          ← only way to interact
       ├─ api.session.create(...)      ← fire event (typed from Model.Class)
       ├─ api.session.on.created(...)  ← subscribe to events
       └─ EventBus transport (IPC)
            ↓
Bun process
  └─ EventLog
       ├─ SessionEvents group          ← exhaustive handlers
       │    └─ handle("session.create") → SessionFeature.create()
       ├─ NavigationEvents group
       │    └─ handle("nav.navigate") → SessionFeature.navigate()
       └─ BookmarkEvents group
            └─ handle("bm.add") → BookmarkFeature.create()
```

### Type Flow (Single Source of Truth)

```
Model.Class (core.base.model)
  ├─→ EventGroup payloads (core.port.event-bus)  — Session.fields.id, Session.insert
  ├─→ useApi() types (core.ui.api)               — auto-generated from EventGroup
  ├─→ Model.makeRepository (domain.adapter.db)   — DB schema from Model
  └─→ EventLog handlers (domain.service.browsing) — typed from EventGroup
```

## EventGroup Definitions

Live in `core.port.event-bus/src/groups/`. Replace existing `signals/*.ts` and action constants.

```typescript
// session.ts
import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"
import { Session } from "@ctrl/core.base.model"

export const SessionEvents = EventGroup.empty
  .add({
    tag: "session.create",
    primaryKey: () => "global",
    payload: Schema.Struct({ mode: Schema.Literal("visual") }),
    success: Session,
  })
  .add({
    tag: "session.close",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({ id: Schema.String }),
  })
  .add({
    tag: "session.activate",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({ id: Schema.String }),
  })
```

```typescript
// navigation.ts
export const NavigationEvents = EventGroup.empty
  .add({
    tag: "nav.navigate",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({ id: Schema.String, input: Schema.String }),
    success: Session,
  })
  .add({
    tag: "nav.back",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({ id: Schema.String }),
    success: Session,
  })
  .add({
    tag: "nav.forward",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({ id: Schema.String }),
    success: Session,
  })
  .add({
    tag: "nav.report",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({ id: Schema.String, url: Schema.String }),
  })
  .add({
    tag: "nav.update-title",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({ id: Schema.String, title: Schema.String }),
  })
```

```typescript
// bookmark.ts
export const BookmarkEvents = EventGroup.empty
  .add({
    tag: "bm.add",
    primaryKey: (p) => p.url,
    payload: Schema.Struct({ url: Schema.String, title: Schema.NullOr(Schema.String) }),
    success: Bookmark,
  })
  .add({
    tag: "bm.remove",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({ id: Schema.String }),
  })
```

```typescript
// Combined schema
import { EventLog } from "@effect/experimental"
export const AppEvents = EventLog.schema(SessionEvents, NavigationEvents, BookmarkEvents)
```

## EventLog Handlers (domain.service.browsing)

Replace `BrowsingHandlersLive`:

```typescript
const SessionHandlers = EventLog.group(SessionEvents, (h) =>
  h
    .handle("session.create", ({ payload }) =>
      Effect.gen(function* () {
        const sessions = yield* SessionFeature
        const session = yield* sessions.create(payload.mode)
        yield* sessions.setActive(session.id)
        return session
      })
    )
    .handle("session.close", ({ payload }) =>
      Effect.gen(function* () {
        const sessions = yield* SessionFeature
        yield* sessions.remove(payload.id)
      })
    )
    .handle("session.activate", ({ payload }) =>
      Effect.gen(function* () {
        const sessions = yield* SessionFeature
        yield* sessions.setActive(payload.id)
      })
    )
)
```

## UI Client (core.ui.api)

`useApi()` provides a typed client generated from EventGroup definitions:

```typescript
const api = useApi()

// Commands — fire event
api.session.create({ mode: "visual" })    // typed: { mode: "visual" }
api.session.close({ id: "abc" })          // typed: { id: string }
api.nav.navigate({ id: "abc", input: "https://..." })

// Subscriptions — reactive signals
const sessions = api.session.on.create()  // Signal<Session>

// Errors at compile time
api.session.create({ mode: "wrong" })     // TS ERROR
```

## What Gets Deleted

| File/Package | Replacement |
|---|---|
| `command-router.ts` | EventLog handlers in domain.service.browsing |
| `BrowsingRpcs` (RpcGroup) | SessionEvents + NavigationEvents (EventGroup) |
| `BrowsingHandlersLive` | EventLog.group() handlers |
| `SidebarFeature.ops` (direct RPC) | `useApi()` calls |
| `useBrowsingRpc()` hook | `useApi()` from core.ui.api |
| `core.shared/model/actions.ts` | Event tags in EventGroup |
| `core.port.event-bus/src/signals/*.ts` | EventGroup definitions |
| `domain.adapter.rpc` | EventBus carrier (later) |
| `core.ports.event-bus` (dead dir) | Delete |

## What Stays

- **SessionFeature, BookmarkFeature, HistoryFeature** — pure business logic, unchanged
- **SessionRepository, BookmarkRepository** — DB layer, unchanged
- **EventBus port** (`event-bus.port.ts`, `event-bus.live.ts`) — transport layer, used by EventLog
- **core.shared** — still needed for ports (SessionRepository etc.) until core.port.storage exists

## Pinned Version

`@effect/experimental@0.58.0` — already in project, pinned via lockfile. EventGroup/EventLog API verified stable at this version.

## Success Criteria

- All tab operations (create, close, activate, navigate, back, forward) work through single path: useApi() → EventLog
- No direct RPC calls from UI
- Adding a new operation = 1 EventGroup entry + 1 handler (2 files)
- TypeScript error if handler is missing (exhaustive)
- TypeScript error if UI sends wrong payload (typed from Model.Class)
- Existing tests pass or are updated to use new API
