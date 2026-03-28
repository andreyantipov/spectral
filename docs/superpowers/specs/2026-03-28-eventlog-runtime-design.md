# EventLog Integration + Runtime Packages

> Finalizes the event-driven architecture by replacing manual dispatch with
> Effect's EventLog framework and extracting DI composition into reusable
> runtime packages.

## Problem

Current implementation has ~100 lines of boilerplate that duplicates information
already defined in EventGroup:
- `tags.ts` — 41 lines of constants mirroring EventGroup tags
- `browsing.handlers.ts` — manual dispatch table + payload validation
- `use-api.ts` — manually typed methods mirroring EventGroup signatures
- DI composition lives in `apps/desktop/`, not reusable

## Solution

1. Use `EventLog.makeClient(AppEvents)` for typed dispatch (zero boilerplate)
2. Use `EventLog.group()` for exhaustive handlers (already defined, wire to EventLog)
3. Extract DI composition into `domain.runtime.bun` and `domain.runtime.webview`

## Architecture

### Source of truth flow

```
EventGroup definitions (core.port.event-bus/groups/*.ts)
  │
  ├─→ EventLog.makeClient(AppEvents)     — typed client, auto-generated
  │     client("session.create", {...})     no manual methods needed
  │
  ├─→ EventLog.group(SessionEvents, ...)  — exhaustive handlers
  │     .handle("session.create", ...)      compiler error if handler missing
  │
  └─→ EventLog.layer(AppEvents)           — wires handlers + journal + identity
```

### Package structure

```
core.port.event-bus/          — EventGroup defs, EventBus port, carrier contract
domain.service.browsing/      — EventLog.group() handlers
domain.runtime.bun/           — Bun DI: storage + features + EventLog + carrier
domain.runtime.webview/       — Webview DI: EventLog client + carrier
apps/desktop/                 — Electrobun wiring only (thin)
```

### Bun side

```typescript
// domain.runtime.bun/src/index.ts
export const BunLive = Layer.mergeAll(
  StorageLive,        // DB + repos
  FeaturesLive,       // session, bookmark, history, layout, omnibox
  EventLogLive,       // EventLog + Journal(memory) + Identity + handlers
  EventBusLive,       // EventBus + RPC handlers (carrier)
  WorkspaceLive,      // workspace handlers
  OtelLive,           // tracing
)
```

```typescript
// apps/desktop/src/bun/layers.ts (thin)
import { BunLive } from "@ctrl/domain.runtime.bun"
export const DesktopLive = BunLive.pipe(
  Layer.provide(makeDbClient(`file:${dbPath}`)),
  Layer.provide(OtelLive(OTEL_SERVICE_NAMES.main)),
)
```

### Webview side

```typescript
// domain.runtime.webview/src/index.ts
export const WebviewLive = Layer.mergeAll(
  EventLogClientLive,   // EventLog + Journal(memory) + Identity
  CarrierLive,          // RPC client protocol + serialization
)
```

```typescript
// apps/desktop/src/main-ui/layers.ts (thin)
import { createWebviewLive } from "@ctrl/domain.runtime.webview"
export const createLive = (rpc) => createWebviewLive(rpc).pipe(
  Layer.provide(OtelWebLive(OTEL_SERVICE_NAMES.webview)),
)
```

### UI API

```typescript
// core.ui.api/use-api.ts
export function useApi() {
  const client = runtime.runSync(EventLog.makeClient(AppEvents))
  // client("session.create", { mode: "visual" })   — typed from EventGroup
  // client("session.close", { id: "abc" })          — typed from EventGroup

  function on<T>(eventName: string): Accessor<T | undefined> { ... }

  return { dispatch: client, on }
}

// Usage in SidebarFeature:
const api = useApi()
api.dispatch("session.create", { mode: "visual" })
api.dispatch("nav.navigate", { id, input: url })
const state = api.on<BrowsingState>("state.snapshot")
```

### Handlers (domain.service.browsing)

```typescript
// EventLog.group replaces manual dispatch table
export const SessionHandlers = EventLog.group(SessionEvents, (h) =>
  h.handle("session.create", ({ payload }) =>
      Effect.gen(function* () {
        const sessions = yield* SessionFeature
        const session = yield* sessions.create(payload.mode)
        yield* sessions.setActive(session.id)
        return session
      }),
    )
    .handle("session.close", ({ payload }) => ...)
    .handle("session.activate", ({ payload }) => ...)
    // missing handler = TS compile error
)
```

### Snapshot publishing

BrowsingServiceLive still publishes `state.snapshot` after mutations.
EventLog.group handlers return values but BrowsingServiceLive wraps
them with snapshot publishing — this part stays manual (10 lines).

## What changes

| File | Change |
|---|---|
| **New: `domain.runtime.bun/`** | Bun DI composition package |
| **New: `domain.runtime.webview/`** | Webview DI composition package |
| `domain.service.browsing/browsing.handlers.ts` | EventLog.group() replaces dispatch table |
| `domain.service.browsing/browsing.handlers.test.ts` | Update tests for EventLog |
| `core.ui.api/use-api.ts` | makeClient replaces manual methods |
| `ui.feature.sidebar/SidebarFeature.tsx` | `api.dispatch()` instead of `api.session.create()` |
| `core.ui/AppShellTemplate.tsx` | `api.dispatch()` instead of `api.send()` |
| `apps/desktop/src/bun/layers.ts` | Thin: import BunLive |
| `apps/desktop/src/main-ui/layers.ts` | Thin: import WebviewLive |

## What gets deleted

| File | Reason |
|---|---|
| `core.port.event-bus/groups/tags.ts` | Tags live in EventGroup |
| `apps/desktop/src/bun/event-bridge.ts` | Absorbed into runtime.bun |

## What stays unchanged

- EventGroup definitions (groups/*.ts)
- EventBus port + live + RPC (carrier)
- All domain features
- All domain adapters
- shortcuts.ts (keyboard config, not boilerplate)
- browsing-state.ts (BrowsingState type)

## Dependencies

```
@effect/experimental@0.58.0 — EventLog, EventGroup, EventJournal (already in project)
```

EventJournal.layerMemory — in-memory, no persistence. Sufficient for local app.
Identity — static string "spectral-bun" / "spectral-webview".

## Testing

### Integration tests (Effect level, no UI)

CRUD flow through EventLog — each test sends a command and asserts snapshot:

```
session.create  → snapshot contains new session with isActive=true
session.close   → snapshot no longer contains closed session
session.activate → snapshot shows correct isActive session
nav.navigate    → snapshot shows updated URL on session
nav.back        → snapshot shows decremented currentIndex
nav.forward     → snapshot shows incremented currentIndex
nav.report      → snapshot shows reported URL
nav.update-title → snapshot shows updated title
bm.add          → snapshot contains new bookmark
bm.remove       → snapshot no longer contains removed bookmark
diag.ping       → diag.pong event published
```

### Runtime smoke tests

Verify layers assemble without errors:

```
domain.runtime.bun    → BunLive builds with mock DB
domain.runtime.webview → WebviewLive builds with mock RPC
```

### App smoke test (manual, in real app)

After implementation, verify in running app via `dev:desktop:agentic`:

```
1. App starts → sidebar shows existing tabs (initial snapshot works)
2. Click "+" or Cmd+T → new tab appears in sidebar
3. Type URL in omnibox → page loads, URL updates in sidebar
4. Click different tab → active tab switches
5. Cmd+W or close button → tab removed from sidebar
6. No errors in /tmp/spectral-dev.log
7. Screenshot confirms visual correctness
```

## Success criteria

- `api.dispatch("session.create", { mode: "wrong" })` — TS error at compile time
- Missing handler in EventLog.group — TS error at compile time
- Adding new command: 1 EventGroup .add() + 1 .handle() callback (2 places)
- All CRUD integration tests pass (11 tests)
- Runtime smoke tests pass (layers build)
- App smoke test passes (7 manual checks)
- No tags.ts, no manual dispatch table, no manual useApi methods
