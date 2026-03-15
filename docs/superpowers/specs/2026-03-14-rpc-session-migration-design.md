# RPC Bridge + Session Model + Legacy Removal Design

**Date:** 2026-03-14
**Status:** Draft
**Scope:** @effect/rpc tunnel over Electrobun IPC, session data model with page history, legacy package removal
**Depends on:** `docs/superpowers/specs/2026-03-14-domain-architecture-design.md` (merged in PR #3)

---

## 1. Problem Statement

The hex architecture is in place (PR #3), but the domain services are only usable on the Bun side. The webview still uses the legacy `feature.sidebar-tabs` with manual RPC. The data model is flat (one URL per tab, no history). Two legacy packages (`core.db`, `feature.sidebar-tabs`) remain.

This spec implements the @effect/rpc bridge to make domain services available in the webview, upgrades the data model from tabs to sessions with page history, and removes all legacy packages.

---

## 2. Package Changes

### Rename
- `domain.feature.tab` → `domain.feature.session`

### Implement
- `domain.adapter.rpc` (generic Effect service tunnel over Electrobun IPC)

### Update
- `core.shared` (Session/Page types + SessionRepository port replace Tab/TabRepository)
- `domain.adapter.db` (session + pages schema replaces tabs schema)
- `domain.service.browsing` (composes sessions instead of tabs)
- `ui.feature.sidebar` (uses session data)
- `ui.scenes` (wired with RuntimeProvider)
- `packages/apps/desktop` (RPC server on Bun, RPC client on webview)

### Remove
- `core.db/`
- `feature.sidebar-tabs/`

### Final package map
```
core.shared                    ports, types (Session, Page), errors, withTracing, spanName
core.ui                        components + bridge utilities (unchanged)

domain.adapter.db              session + pages schema, repositories
domain.adapter.otel            telemetry (unchanged)
domain.adapter.rpc             generic Effect↔Electrobun IPC tunnel
domain.feature.session         session service: create, navigate, back/forward, history
domain.service.browsing        composes sessions (PUBLIC API)

ui.feature.sidebar             wires BrowsingService → Sidebar
ui.scenes                       MainPage with RuntimeProvider
```

---

## 3. Session Data Model

### 3.1 Domain Types (core.shared) — Single Source of Truth

**Effect Schema defines the shape ONCE. Everything else derives from it.**

```typescript
// core.shared/src/model/schemas.ts — THE source of truth

export const PageSchema = Schema.Struct({
  url: Schema.String,
  title: Schema.NullOr(Schema.String),
  loadedAt: Schema.String,
})

export const SessionSchema = Schema.Struct({
  id: Schema.String,
  pages: Schema.Array(PageSchema),
  currentIndex: Schema.Number,
  mode: Schema.Literal("visual"),
  isActive: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

export const BrowsingStateSchema = Schema.Struct({
  sessions: Schema.Array(SessionSchema),
})

// Types DERIVED from schemas — no manual type definitions
export type Page = Schema.Schema.Type<typeof PageSchema>
export type Session = Schema.Schema.Type<typeof SessionSchema>
export type BrowsingState = Schema.Schema.Type<typeof BrowsingStateSchema>
```

**No separate `types.ts` file.** Types, validation, and RPC serialization all come from the same Schema definition.

**DB mapping:** The `Page` domain type is a clean value object (no `id`, no `pageIndex`). The DB `pages` table has `id` (primary key) and `pageIndex` (ordering column) — these are adapter-internal. The `SessionRepository` implementation reconstructs `Page[]` arrays from ordered DB rows, stripping adapter-internal fields. Drizzle schema in the adapter validates against the derived types via `satisfies`.

### 3.2 Derived Accessors (domain.feature.session/lib/)

Pure functions — no Effect, no side effects, unit-testable:

```typescript
const currentPage = (session: Session): Page | undefined =>
  session.pages[session.currentIndex]

const canGoBack = (session: Session): boolean =>
  session.currentIndex > 0

const canGoForward = (session: Session): boolean =>
  session.currentIndex < session.pages.length - 1

const currentUrl = (session: Session): string =>
  currentPage(session)?.url ?? DEFAULT_TAB_URL
```

### 3.3 DB Schema (domain.adapter.db)

Two tables — sessions own pages:

```
sessions
  id            TEXT PRIMARY KEY
  mode          TEXT NOT NULL DEFAULT 'visual'
  isActive      INTEGER NOT NULL DEFAULT 0
  currentIndex  INTEGER NOT NULL DEFAULT 0
  createdAt     TEXT NOT NULL
  updatedAt     TEXT NOT NULL

pages
  id            TEXT PRIMARY KEY
  sessionId     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
  url           TEXT NOT NULL
  title         TEXT
  pageIndex     INTEGER NOT NULL
  loadedAt      TEXT NOT NULL
```

Type validation via `satisfies` — Drizzle inferred types checked against domain types at compile time.

### 3.4 SessionRepository Port (core.shared)

```typescript
export const SESSION_REPOSITORY_ID = "SessionRepository" as const

export class SessionRepository extends Context.Tag(SESSION_REPOSITORY_ID)<SessionRepository, {
  // Session CRUD
  readonly getAll: () => Effect<Session[], DatabaseError>
  readonly getById: (id: string) => Effect<Session | undefined, DatabaseError>
  readonly create: (mode: "visual") => Effect<Session, DatabaseError>
  readonly remove: (id: string) => Effect<void, DatabaseError>
  readonly setActive: (id: string) => Effect<void, DatabaseError>
  readonly updateCurrentIndex: (id: string, index: number) => Effect<void, DatabaseError>
  // Page CRUD
  readonly addPage: (sessionId: string, url: string, atIndex: number) => Effect<Page, DatabaseError>
  readonly removePagesAfterIndex: (sessionId: string, index: number) => Effect<void, DatabaseError>
  readonly updatePageTitle: (sessionId: string, pageIndex: number, title: string) => Effect<void, DatabaseError>
}>() {}
```

The repository is pure persistence — it provides low-level primitives. Navigation logic (truncate forward history, append page, move index) lives in `SessionFeature`, which composes these primitives into atomic operations.

---

## 4. RPC Adapter — Generic Effect Service Tunnel

### 4.1 Design Principle

`domain.adapter.rpc` is **transport only**. It knows nothing about sessions, browsing, or any domain concept. It tunnels @effect/rpc protocol messages through Electrobun's IPC message channel.

### 4.2 Architecture

```
Webview                          Bun
───────                          ───
@effect/rpc client               @effect/rpc server
      │                                │
ElectrobunClientProtocol         ElectrobunServerProtocol
      │                                │
Electrobun message("effect-rpc") ←→ Electrobun message listener
      │                                │
      └──── WebSocket (AES-256-GCM) ───┘
```

### 4.3 ElectrobunRpcHandle Type

The protocol factories accept an Electrobun RPC handle — the object returned by `BrowserView.createRPC()` on the Bun side and `Electroview.defineRPC()` on the webview side. The type is defined in `domain.adapter.rpc`:

```typescript
// domain.adapter.rpc/src/model/electrobun-rpc.ts

type ElectrobunRpcHandle = {
  readonly send: Record<string, (payload: unknown) => void>
  readonly addMessageListener: (channel: string, handler: (data: unknown) => void) => void
}
```

This is a structural type matching Electrobun's actual API surface — no Electrobun imports needed.

### 4.4 Bun Side — ElectrobunServerProtocol

Implements `RpcServer.Protocol`:

```typescript
// domain.adapter.rpc/src/api/server-protocol.ts

export const ElectrobunServerProtocol = (electrobunRpc: ElectrobunRpcHandle) =>
  RpcServer.Protocol.make((writeRequest) =>
    Effect.gen(function*() {
      const disconnects = yield* Mailbox.make<number>()

      // Listen for incoming messages on "effect-rpc" channel
      electrobunRpc.addMessageListener("effect-rpc", (data: unknown) => {
        writeRequest(0, data)  // clientId 0 — single webview
      })

      return {
        send: (clientId, response) =>
          Effect.sync(() => electrobunRpc.send.effectRpc(response)),
        disconnects,
        end: () => Effect.void,
        clientIds: Effect.sync(() => new Set([0])),
        initialMessage: Effect.succeedNone,
        supportsAck: false,
        supportsTransferables: false,
        supportsSpanPropagation: true,
      }
    })
  )
```

### 4.5 Webview Side — ElectrobunClientProtocol

Implements `RpcClient.Protocol`:

```typescript
// domain.adapter.rpc/src/api/client-protocol.ts

export const ElectrobunClientProtocol = (electrobunRpc: ElectrobunRpcHandle) =>
  RpcClient.Protocol.make((writeResponse) =>
    Effect.gen(function*() {
      // Listen for server responses on "effect-rpc" channel
      electrobunRpc.addMessageListener("effect-rpc", (data: unknown) => {
        writeResponse(data)
      })

      return {
        send: (request) =>
          Effect.sync(() => electrobunRpc.send.effectRpc(request)),
        supportsAck: false,
        supportsTransferables: false,
      }
    })
  )
```

### 4.6 Serialization

JSON serialization. Each Electrobun message carries one complete JSON payload. @effect/rpc handles its own multiplexing internally — multiple in-flight requests, streaming chunks, and responses are all differentiated by request IDs within the protocol. Use `RpcSerialization.layerJson` (not NDJSON — framing is handled by Electrobun's per-message transport, not by newline delimiters).

### 4.7 Electrobun RPC Schema Update

Add `effectRpc` as a message channel in the Electrobun RPC schema (in `core.shared/rpc-schemas.ts` or wherever the schema is defined):

```typescript
// Both sides can send effect-rpc messages
messages: {
  effectRpc: unknown  // @effect/rpc handles its own protocol
}
```

### 4.8 Streaming

Streaming works automatically. @effect/rpc sends Chunk/Exit packets as individual messages through the tunnel. `BrowsingService.changes` (a Stream) flows through without any special handling.

---

## 5. Service Composition

### 5.1 domain.feature.session

Same service pattern as the previous tab feature, upgraded with session model:

```typescript
export const SESSION_FEATURE = "SessionFeature" as const

export class SessionFeature extends Context.Tag(SESSION_FEATURE)<SessionFeature, {
  readonly getAll: () => Effect<Session[], DatabaseError>
  readonly create: (mode: "visual") => Effect<Session, DatabaseError>
  readonly remove: (id: string) => Effect<void, DatabaseError>
  readonly navigate: (id: string, url: string) => Effect<Session, DatabaseError>
  readonly goBack: (id: string) => Effect<Session, DatabaseError>
  readonly goForward: (id: string) => Effect<Session, DatabaseError>
  readonly setActive: (id: string) => Effect<void, DatabaseError>
  readonly updateTitle: (id: string, title: string) => Effect<void, DatabaseError>
  readonly changes: Stream<Session[]>
}>() {}
```

Navigation logic lives HERE (not in repository):
- `navigate(id, url)` — calls `repo.removePagesAfterIndex(id, currentIndex)`, then `repo.addPage(id, url, currentIndex + 1)`, then `repo.updateCurrentIndex(id, currentIndex + 1)`
- `goBack(id)` — calls `repo.updateCurrentIndex(id, currentIndex - 1)` (validates `canGoBack` first)
- `goForward(id)` — calls `repo.updateCurrentIndex(id, currentIndex + 1)` (validates `canGoForward` first)
- `updateTitle(id, title)` — calls `repo.updatePageTitle(id, currentIndex, title)`. Called from Bun side when BrowserView reports title change — may not traverse RPC.

PubSub reactivity — same pattern. Mutations call `notify()` (with `Effect.ignore`) to push updated session list.

### 5.2 domain.service.browsing (updated)

**Single source of truth:** The RPC group defines the service contract. `BrowsingService` is derived from it — no duplication.

```typescript
// domain.service.browsing/src/api/browsing.rpc.ts — THE source of truth

export class BrowsingRpcs extends RpcGroup.make(
  Rpc.make("createSession", { payload: { mode: Schema.Literal("visual") }, success: SessionSchema }),
  Rpc.make("removeSession", { payload: { id: Schema.String }, success: Schema.Void }),
  Rpc.make("navigate", { payload: { id: Schema.String, url: Schema.String }, success: SessionSchema }),
  Rpc.make("goBack", { payload: { id: Schema.String }, success: SessionSchema }),
  Rpc.make("goForward", { payload: { id: Schema.String }, success: SessionSchema }),
  Rpc.make("getSessions", { success: Schema.Array(SessionSchema) }),
  Rpc.make("setActive", { payload: { id: Schema.String }, success: Schema.Void }),
  Rpc.make("updateTitle", { payload: { id: Schema.String, title: Schema.String }, success: Schema.Void }),
  Rpc.make("sessionChanges", { success: RpcSchema.Stream({ success: BrowsingStateSchema }), stream: true }),
) {}
```

The RPC group defines serialization schemas AND the service contract. Handlers are implemented as an Effect Layer. On the client side, `@effect/rpc` auto-generates a typed client from the same group.

**No separate `BrowsingService` Context.Tag.** The RPC group IS the contract. Both server (handler implementation) and client (auto-generated proxy) derive from `BrowsingRpcs`. This eliminates duplication and ensures the wire format always matches the service interface.

RPC handlers and the handler Layer live in `domain.service.browsing` — NOT in `domain.adapter.rpc` (which stays generic).

**Note:** `updateTitle` is included in the RPC group for completeness, but is primarily called from the Bun side when a BrowserView reports a title change. The webview receives updated titles via the `sessionChanges` stream.

---

## 6. App Wiring

### 6.1 Bun Composition Root

```typescript
// packages/apps/desktop/src/bun/layers.ts

// Domain layers (unchanged pattern)
const DesktopLive = BrowsingServiceLive.pipe(
  Layer.provide(SessionFeatureLive),
  Layer.provide(SessionRepositoryLive),
  Layer.provide(DbClientLive),
  Layer.provide(OtelLive(OTEL_SERVICE_NAMES.main)),
)

// RPC server — serves BrowsingService over Electrobun IPC
const RpcServerLive = RpcServer.layer(BrowsingRpcs).pipe(
  Layer.provide(BrowsingRpcHandlers),
  Layer.provide(ElectrobunServerProtocol(electrobunRpc)),
  Layer.provide(RpcSerialization.layerJson),
)
```

### 6.2 Webview Composition Root (NEW)

```typescript
// packages/apps/desktop/src/main-ui/layers.ts

const WebviewLive = RpcClient.layer(BrowsingRpcs).pipe(
  Layer.provide(ElectrobunClientProtocol(electrobunRpc)),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(OtelLive(OTEL_SERVICE_NAMES.webview)),
)
```

**No bridging needed.** Since `BrowsingRpcs` IS the service contract, `@effect/rpc` auto-generates a typed client that UI code uses directly:

```typescript
// webview usage
const client = yield* RpcClient.make(BrowsingRpcs)
yield* client.createSession({ mode: "visual" })
const changes = client.sessionChanges({})  // Stream
```

`ui.feature.sidebar` uses the RPC client directly — no intermediate Context.Tag.

### 6.3 App.tsx (Updated)

```typescript
import { RuntimeProvider } from "@ctrl/core.ui"
import { MainPage } from "@ctrl/ui.scenes"

export function App(props: { runtime: ManagedRuntime<typeof WebviewLive> }) {
  return (
    <RuntimeProvider runtime={props.runtime}>
      <MainPage />
    </RuntimeProvider>
  )
}
```

### 6.4 TabManager → ViewManager

Strip domain logic, keep only BrowserView management:

- Rename to `ViewManager` (manages visual browser views, not domain sessions)
- Listens to `BrowsingService.changes` stream to sync BrowserViews:
  - Session created → create BrowserView
  - Session removed → destroy BrowserView
  - Session navigated → update BrowserView URL
  - Session activated → bring BrowserView to front
- Keeps BrowserView positioning, resize, and layout logic

---

## 7. Legacy Removal

### 7.1 Packages to Delete
- `packages/libs/core.db/` — fully replaced by `domain.adapter.db`
- `packages/libs/feature.sidebar-tabs/` — fully replaced by `domain.service.browsing` + `ui.feature.sidebar`

### 7.2 Files to Clean Up
- `core.shared/src/rpc-schemas.ts` — gut old Electrobun RPC schema, keep only `effectRpc` message channel definition. The file stays but with minimal content.
- Old `Tab` type, `TabRepository` port → replaced by `Session`, `SessionRepository`
- Old tab-specific constants (`TAB_FEATURE`, `TAB_REPOSITORY_ID`, etc.)

### 7.3 Workspace-Level Cleanup
- Remove `core.db` and `feature.sidebar-tabs` from root `package.json` workspaces (if explicitly listed)
- Remove tsconfig references to deleted packages from `packages/apps/desktop/tsconfig.json`
- Run `bun install` to clean lockfile
- Verify `turbo check` passes with packages removed

### 7.4 Import Migration
| Old import | New import |
|---|---|
| `@ctrl/core.db` | removed (no replacement needed — adapter is internal) |
| `@ctrl/feature.sidebar-tabs` | removed (use `@ctrl/domain.service.browsing` + `@ctrl/ui.feature.sidebar`) |
| `Tab` from `@ctrl/core.shared` | `Session` from `@ctrl/core.shared` |
| `TabRepository` from `@ctrl/core.shared` | `SessionRepository` from `@ctrl/core.shared` |
| `TabFeature` from `@ctrl/domain.feature.tab` | `SessionFeature` from `@ctrl/domain.feature.session` |
| `TAB_FEATURE` | `SESSION_FEATURE` |
| `TabManager` in `apps/desktop` | `ViewManager` (stripped of domain logic, BrowserView management only) |

---

## 8. Testing

### 8.1 Updated Tests

All existing tests migrate from tab → session terminology:
- `domain.adapter.db` — session repository tests (CRUD + navigate + goBack/goForward)
- `domain.feature.session` — service tests with PubSub (same pattern, session model)
- `domain.service.browsing` — trace assertions (session flow)
- Pipeline test — full e2e with session creation

### 8.2 New Tests

**RPC tunnel test:**
- Verify service calls traverse the Electrobun message channel
- Mock Electrobun's message API (send/listen)
- Assert: client call → message sent → server receives → response flows back
- Assert: streaming works (sessionChanges delivers chunks)

**Session navigation tests:**
- `navigate()` appends page, truncates forward history
- `goBack()` decrements index, fails at 0
- `goForward()` increments index, fails at end
- History integrity after navigate → back → navigate (forward history truncated)

### 8.3 Test Levels (same as architecture spec)

| Level | Coverage |
|---|---|
| L1 Unit | Session repository, session feature, navigation logic |
| L2 Trace | BrowsingService → SessionFeature → SessionRepository span chain |
| L4 Pipeline | Full flow: create session → navigate → stream delivers → trace verified |

---

## 9. Deferred

- Headless session mode (`mode: "headless"`) — future PR
- `domain.feature.workspace` — when multiple workspace contexts are needed
- Storybook L3 story interaction tests — next PR
- `makeFeatureService` factory extraction — next PR with second feature
