# FSM-Spec Architecture Design

## Goal

Replace imperative service handlers with declarative FSM workflows. All business logic flows through spec-driven state machines. Features are isolated effect handlers. Routing is automatic from spec registration.

## Package Naming Convention

Five top-level namespaces. Alphabetical order = dependency direction. Three levels everywhere: `namespace.tier.name`.

```
arch.*.*       (a) → zero deps — infrastructure foundation
base.*.*       (b) → arch.* — business foundation (models, operations, specs)
feature.*.*    (f) → arch.*, base.* — business implementation (effects)
ui.*.*         (u) → base.* — presentation
wire.*.*       (w) → all — composition root
```

`a → b → f → u → w`

**Cross-import rule:** Within the same tier, no cross-imports. `arch.contract.X` cannot import `arch.contract.Y`. `feature.browser.X` cannot import `feature.browser.Y`. Enforced by ast-grep.

### arch.*.* — Infrastructure (zero deps, no business knowledge)

```
arch.contract.spec          → generic Spec type + FsmSpecSchema (Effect Schema)
arch.contract.spec-runner   → SpecRunner interface (spawn, destroy, dispatch)
arch.contract.spec-registry → SpecRegistry interface (register, describe)
arch.contract.feature-registry → FeatureRegistry interface (register, execute, has)
arch.contract.db            → generic DB client interface
arch.contract.ipc           → generic IPC interface

arch.impl.spec-runner       → SpecRunner implementation (Ref + Queue + FiberMap)
arch.impl.spec-registry     → SpecRegistry implementation (auto-routing from triggers/terminalOn)
arch.impl.feature-registry  → FeatureRegistry implementation (Ref<Map>)
arch.impl.db                → SQLite/Drizzle client, migrations (generic, no business tables)
arch.impl.ipc               → Electrobun IPC bridge

arch.utils.spec-builder     → Spec.make() builder DSL

arch.middleware.otel         → OTEL tracing
arch.middleware.mcp          → MCP server
```

`arch` does not import from `base`, `feature`, `ui`, or `wire`. Ever.
Each contract is one package with one interface. No cross-imports between contracts.
Each impl imports only its own contract.

### base.*.* — Business foundation (declarations, no implementation)

Dependency order within base tiers: `model (m) → op (o) → spec (s)`. Enforced by ast-grep.

```
base.model.session          → Session, Page schemas (Effect Schema)
base.model.bookmark         → Bookmark schema
base.model.error            → DatabaseError, ValidationError
base.model.history          → History schema
base.model.shortcut         → Shortcut schema

base.op.browsing            → Navigate, CreateSession, CloseSession, UrlCommitted, TitleChanged + Effects constants
base.op.bookmark            → AddBookmark, RemoveBookmark, GetAllBookmarks + Effects constants
base.op.workspace           → AddPanel, ClosePanel, SplitPanel, ActivatePanel + Effects constants
base.op.system              → ToggleOmnibox, ToggleSidebar, diagnostics + Effects constants

base.spec.web-session       → WebSessionSpec FSM (per-instance, tab lifecycle)
base.spec.bookmark-manager  → BookmarkManagerSpec FSM (singleton)
base.spec.history-manager   → HistoryManagerSpec FSM (singleton)
base.spec.workspace-manager → WorkspaceManagerSpec FSM (singleton)
base.spec.runtime-manager   → RuntimeManagerSpec FSM (singleton, app startup/restore)

base.utils.tracing          → withTracing helper
base.utils.type             → shared type utilities
```

Actions are `Schema.TaggedClass` with `.make()` factory. Fire-and-forget, no response.

Effect name constants in `base.op.*` — single source of truth, no string notation in specs or features.

Specs built using `arch.utils.spec-builder`. JSON-serializable. Reference action `_tag` strings via imports from `base.op.*`. Reference effect names via `Effects` constants from `base.op.*`.

### feature.*.* — Business implementation (effects)

Grouped by domain, then by feature area:

```
feature.browser.navigation   → nav.start, nav.cancel, url.isValid guard
feature.browser.session      → session.create, session.close, session.updateTitle, session.updateUrl
feature.browser.history      → history.record, history.getAll, history.search, history.clear
feature.browser.bookmarks    → bookmark.save, bookmark.remove, bookmark.getAll

feature.workspace.layout     → workspace.addPanel, workspace.closePanel, workspace.updateLayout
feature.workspace.settings   → settings.getShortcuts, settings.update

feature.general.omnibox      → omnibox.resolve
```

Features are flat maps of named effects registered in FeatureRegistry. Called only by SpecRunner.

Drizzle table schemas live inside feature packages (not in arch.impl.db).

Guards are regular effects that return boolean. FeatureRegistry does not distinguish guards from effects. SpecRunner knows the difference by position in spec (`guards: [...]` vs `effects: [...]`).

Features can:
- Read/write DB via Drizzle (get SqliteDrizzle from context)
- Dispatch actions to EventBus (outbound, for cross-domain triggers)

Features cannot:
- Call other features directly
- Access SpecRunner
- Import from other feature packages

### ui.*.* — Presentation

```
ui.base.api                  → useDispatch, RuntimeProvider
ui.base.components           → design system, Panda CSS
ui.feature.sidebar           → sidebar
ui.feature.webview           → ManagedWebview (translates native events → actions)
ui.feature.workspace         → workspace layout
ui.feature.keyboard-provider → keyboard shortcuts
ui.scene.main                → main scene composition
```

UI imports from `base.op.*` for typed dispatch:
```ts
import { Navigate } from "@ctrl/base.op.browsing"
dispatch(Navigate.make({ instanceId: tabId, url: "google.com" }))
```

UI does not know FSM exists. Dispatches actions, reads state from DB (Loro later).

### wire.*.* — Composition root

```
wire.desktop.main            → register specs + features, Layer wiring, IPC bridge
wire.desktop.ui              → webview wiring
```

Only registration, zero manual routing:
```ts
yield* specRegistry.register(WebSessionSpec)
yield* featureRegistry.registerAll(yield* sessionEffects)
yield* featureRegistry.registerAll(yield* navigationEffects)
```

Routing is automatic consequence of registration. Old domain.service.browsing is removed — SpecRunner replaces it.

## FsmSpec Type

Defined in `arch.contract.spec`. Compatible across all arch packages.

```ts
export const TransitionSchema = Schema.Struct({
  target: Schema.String,
  guards: Schema.optional(Schema.Array(Schema.String)),
  effects: Schema.optional(Schema.Array(Schema.String)),
  compensate: Schema.optional(Schema.Array(Schema.String)),
})

export const StateNodeSchema = Schema.Struct({
  on: Schema.optional(Schema.Record({ key: Schema.String, value: TransitionSchema })),
})

export const FsmSpecSchema = Schema.Struct({
  id: Schema.String,
  version: Schema.Number,
  domain: Schema.String,
  mode: Schema.Literal("instance", "singleton"),
  initial: Schema.String,
  triggers: Schema.Array(Schema.String),
  terminalOn: Schema.Array(Schema.String),
  states: Schema.Record({ key: Schema.String, value: StateNodeSchema }),
})
```

Static creation: `satisfies FsmSpec` — TypeScript validates structure.
Dynamic creation: `Schema.decodeUnknown(FsmSpecSchema)(json)` — runtime validation.
JSON Schema export: `JSONSchema.make(FsmSpecSchema)` — for agents/extensions.

## SpecBuilder DSL

Lives in `arch.utils.spec-builder`. Builds validated FsmSpec objects.

```ts
const WebSessionSpec = Spec.make("web-session", { mode: "instance", domain: "session", version: 1 })
  .initial("idle")
  .triggers(CreateSession)
  .terminalOn(CloseSession)
  .state("idle", (s) => s
    .on(Navigate, "loading", { guards: [Effects.URL_IS_VALID], effects: [Effects.NAV_START] })
  )
  .state("loading", (s) => s
    .on(UrlCommitted, "browsing", {
      effects: [Effects.SESSION_UPDATE_TITLE, Effects.SESSION_UPDATE_FAVICON, Effects.HISTORY_RECORD],
    })
    .on(NavigationFailed, "error", { effects: [Effects.SESSION_SET_ERROR] })
  )
  .state("browsing", (s) => s
    .on(Navigate, "loading", { guards: [Effects.URL_IS_VALID], effects: [Effects.NAV_START] })
    .on(TitleChanged, "browsing", { effects: [Effects.SESSION_UPDATE_TITLE] })
    .on(CloseSession, "closed", { effects: [Effects.SESSION_CLOSE] })
  )
  .state("error", (s) => s
    .on(Navigate, "loading", { effects: [Effects.NAV_START] })
    .on(CloseSession, "closed")
  )
  .state("closed")
  .build()
```

`.build()` validates: initial state exists, all transition targets exist. Returns plain FsmSpec object.

## SpecRunner

Works through EventBus. Subscribes to commands, routes to per-instance Queues. Writes transitions to EventBus as events (journal).

### Per-instance loop

```ts
const runInstance = (spec, instanceId, features, bus) =>
  Effect.gen(function* () {
    const state = yield* Ref.make(spec.initial)
    const queue = yield* Queue.unbounded()

    yield* Effect.forever(
      Effect.gen(function* () {
        const action = yield* Queue.take(queue)
        const current = yield* Ref.get(state)
        const transition = spec.states[current]?.on?.[action._tag]

        if (!transition) return

        // Guards — sequential, any false → drop
        if (transition.guards) {
          for (const guard of transition.guards) {
            const passed = yield* features.execute(guard, action)
            if (!passed) return
          }
        }

        // Transition
        yield* Ref.set(state, transition.target)

        // Effects — sequential
        yield* Effect.forEach(
          transition.effects ?? [],
          (name) => features.execute(name, action),
          { concurrency: 1 },
        )

        // Journal — publish transition event
        yield* bus.publish({
          type: "event",
          name: "spec.transition",
          payload: {
            specId: spec.id, instanceId,
            from: current, to: transition.target,
            action: action._tag,
          },
          timestamp: Date.now(),
        })
      })
    )
  })
```

### Routing (in SpecRunnerLive)

```ts
// SpecRunnerLive manages FiberMap of instances
const fiberMap = yield* FiberMap.make()
const queues = new Map<string, Queue>()
const specs = new Map<string, FsmSpec>()  // populated by SpecRegistry

spawn: (specId, instanceId, options?) => {
  const spec = specs.get(specId)
  // runInstance creates its own queue, stored in queues map
  yield* FiberMap.run(fiberMap, instanceId, runInstance(spec, instanceId, features, bus))
}

dispatch: (instanceId, action) => {
  const queue = queues.get(instanceId)
  if (queue) yield* Queue.offer(queue, action)
}

destroy: (specId, instanceId) => {
  yield* FiberMap.remove(fiberMap, instanceId)
  queues.delete(instanceId)
}
```

### Three routing cases

Determined by spec metadata when action arrives from EventBus:

1. **singleton** (`mode: "singleton"`) — instanceId = spec.id, single Queue
2. **trigger** (`action._tag in spec.triggers`) — spawn new instance, generate UUID via `crypto.randomUUID()`
3. **normal** — route by `action.instanceId` to existing Queue. No instance → drop.

### Action payload

Full action object passed as-is to features. Feature destructures what it needs:

```ts
// Action: UrlCommitted { _tag, instanceId, url, title, favicon }
// Feature "session.updateTitle" only uses instanceId and title, ignores rest
```

## Cross-Spec Choreography

Features dispatch outbound actions to EventBus:

```ts
// feature.browser.session
"session.create": (p) => Effect.gen(function* () {
  const bus = yield* EventBus
  yield* db.insert(sessionsTable, { id: p.instanceId, ... })
  yield* bus.send({ type: "command", action: "ws.add-panel", payload: { sessionId: p.instanceId } })
})
```

Feature does not know who handles `ws.add-panel`. EventBus routes to WorkspaceManagerSpec (when migrated).

## Restore on Startup

RuntimeManager (singleton spec) reads persisted entities, dispatches RestoreEntity for each. SpecRunner supports `initialState` parameter at spawn to restore to saved FSM state.

## Migration Strategy

Per domain, in one PR. Old service removed, new spec + features registered. No parallel execution.

First domain: browser (session + navigation + history). Remaining domains in follow-up PRs.

## What This Replaces

| Before | After |
|--------|-------|
| `base.*` (2-level utils) | `base.utils.*` (3-level) |
| `core.contract.event-bus` groups | `base.op.*` action schemas |
| `core.contract.storage` repositories | removed, DB access in features |
| `core.impl.db` schemas + repos | `arch.impl.db` (client only) + schemas in features |
| `core.impl.event-bus` | stays as EventBus transport, SpecRunner subscribes to it |
| `domain.feature.*` Context.Tag services | `feature.*.*` flat effect maps |
| `domain.service.*` handlers | removed, replaced by FSM specs + SpecRunner |
| Choreography via `typedSend` | Outbound dispatch from features |
| `Stream.runForEach` sequential | Per-instance Queue, parallel instances |

## Out of Scope (for now)

- Loro integration — features write to DB only, Loro added later as projection
- AI/agent dynamic spec generation — registry supports it, not implemented yet
- Extension sandboxing — registry supports it, not implemented yet
- @effect/rpc integration for UI DX — `.make()` sufficient for now
- OTEL verbosity config — basic tracing only
- Retry/timeout in specs — not in first PR
- Compensation/rollback — spec supports `compensate` field, runner ignores it in first PR
- @effect/sql Model.Class unification — evaluate after initial migration
