# Event-Driven Architecture Design

## Problem

Current architecture has fragmented communication:
- **IPC Bridge** (AppCommand) — fire-and-forget between Electrobun native ↔ Bun
- **RPC** (Effect RPC) — request/response between Bun ↔ webview
- **PubSub per feature** — each feature has its own change stream
- **UI ops objects** — scattered action definitions in components

This leads to:
- Adding a new operation requires changes in 5-9 files across 3-4 packages
- No unified action dispatch — keyboard shortcuts, context menus, agents, and UI each wire differently
- Services can't compose (service-to-service import forbidden)
- Agent/extension model impossible without a universal command interface

## Solution

Introduce an **EventBus** — the single business logic layer where all commands and events flow. The EventBus rides on top of a **carrier** (IPC+RPC) which handles process boundary crossing.

## Architecture

### Carrier + EventBus

```
┌──────────────────────────────────────────────────────────────┐
│  Carrier (infrastructure — process boundary crossing)         │
│                                                               │
│  IPC (needed for Electrobun/Bun native process communication) │
│  RPC (needed for Effect typed serialization + Bun ↔ Webview)  │
│                                                               │
│  Native ←──IPC──→ Bun process ←──RPC──→ Webview process      │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  EventBus (business logic — ALL commands & events)     │   │
│  │                                                        │   │
│  │  Commands: session.create, nav.navigate, ws.split, ... │   │
│  │  Events: session.created, nav.navigated, ...           │   │
│  │  Subscribers: UI, services, agents, telemetry          │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Carrier** = IPC (needed for Bun) + RPC (needed for Effect). Infrastructure only — serialization, encryption, process boundaries. Not business logic.

**EventBus** = where ALL business happens. Every command and every event flows through here regardless of source (keyboard, agent, UI, system) or direction (Bun→UI, UI→Bun, service→service). Features, services, and UI never touch the carrier directly — they only speak EventBus.

The carrier is invisible to business code. Like TCP is invisible to HTTP.

### Core Package Levels

```
Level 1: core.ports.*    → pure interfaces (Context.Tag), zero deps
Level 2: core.shared     → schemas, errors, utilities
Level 3: core.ui         → components, hooks
```

Atomic port packages:
- `core.ports.storage` — SessionRepository, BookmarkRepository, HistoryRepository, LayoutRepository
- `core.ports.webview` — WebviewExecutor (evaluate JS, navigate, lifecycle events)
- `core.ports.event-bus` — EventBus (send commands, subscribe to events, publish events)

### EventBus Port

```typescript
// core.ports.event-bus/src/index.ts

type AppCommand = {
  readonly type: "command";
  readonly action: string;
  readonly payload?: unknown;
  readonly meta?: { source: "keyboard" | "menu" | "agent" | "ui" | "system" };
};

type AppEvent = {
  readonly type: "event";
  readonly name: string;
  readonly payload?: unknown;
  readonly timestamp: number;
  readonly causedBy?: string; // command action that produced this event
};

class EventBus extends Context.Tag("EventBus")<
  EventBus,
  {
    readonly send: (command: AppCommand) => Effect.Effect<void>;
    readonly publish: (event: AppEvent) => Effect.Effect<void>;
    readonly commands: Stream.Stream<AppCommand>;   // subscribe to all commands
    readonly events: Stream.Stream<AppEvent>;       // subscribe to all events
    readonly on: (eventName: string) => Stream.Stream<AppEvent>; // filtered subscription
  }
>() {}
```

### Command Catalog

Static definitions in `core.shared`:

```typescript
// core.shared/src/model/actions.ts

// Session commands
const SESSION_CREATE   = "session.create"   // payload: { mode: "visual" }
const SESSION_CLOSE    = "session.close"    // payload: { id: string }
const SESSION_ACTIVATE = "session.activate" // payload: { id: string }

// Navigation commands
const NAV_NAVIGATE  = "nav.navigate"  // payload: { sessionId: string, url: string }
const NAV_BACK      = "nav.back"      // payload: { sessionId: string }
const NAV_FORWARD   = "nav.forward"   // payload: { sessionId: string }

// Workspace commands
const WS_SPLIT_RIGHT = "ws.split-right" // payload: { sessionId: string }
const WS_SPLIT_DOWN  = "ws.split-down"  // payload: { sessionId: string }
const WS_CLOSE_PANE  = "ws.close-pane"  // payload: { paneId: string }
const WS_FOCUS_PANE  = "ws.focus-pane"  // payload: { paneId: string }

// Bookmark commands
const BM_ADD    = "bm.add"    // payload: { url: string, title: string | null }
const BM_REMOVE = "bm.remove" // payload: { id: string }

// Agent commands
const AGENT_CREATE_HEADLESS = "agent.create-headless" // payload: { url?: string }
const AGENT_EVALUATE_JS     = "agent.evaluate-js"     // payload: { sessionId: string, script: string }
const AGENT_CLOSE_HEADLESS  = "agent.close-headless"  // payload: { sessionId: string }

// UI commands
const UI_TOGGLE_OMNIBOX = "ui.toggle-omnibox"
const UI_TOGGLE_SIDEBAR = "ui.toggle-sidebar"
```

### Event Catalog

```typescript
// Domain events (produced by command handlers)
const SESSION_CREATED   = "session.created"   // payload: { id, mode }
const SESSION_CLOSED    = "session.closed"    // payload: { id }
const SESSION_ACTIVATED = "session.activated" // payload: { id }
const NAVIGATED         = "nav.navigated"     // payload: { sessionId, url, previousUrl }
const LAYOUT_CHANGED    = "ws.layout-changed" // payload: { layout: LayoutNode }
const PANE_SPLIT        = "ws.pane-split"     // payload: { paneId, newPaneId, direction }

// System events (from IPC/Electrobun)
const WEBVIEW_DOM_READY    = "sys.dom-ready"     // payload: { webviewId }
const WEBVIEW_DID_NAVIGATE = "sys.did-navigate"  // payload: { webviewId, url }
```

### Shortcut Registry

```typescript
// core.shared/src/model/shortcuts.ts

type ShortcutBinding = {
  readonly action: string;      // command action ID
  readonly shortcut: string;    // "Cmd+T", "Cmd+D", "Cmd+W"
  readonly label: string;       // "New Tab", "Split Right", "Close Tab"
  readonly when?: string;       // context condition: "workspace.hasSplit"
};

const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { action: SESSION_CREATE,   shortcut: "Cmd+T",       label: "New Tab" },
  { action: SESSION_CLOSE,    shortcut: "Cmd+W",       label: "Close Tab" },
  { action: NAV_BACK,         shortcut: "Cmd+[",       label: "Back" },
  { action: NAV_FORWARD,      shortcut: "Cmd+]",       label: "Forward" },
  { action: WS_SPLIT_RIGHT,   shortcut: "Cmd+D",       label: "Split Right" },
  { action: WS_SPLIT_DOWN,    shortcut: "Cmd+Shift+D", label: "Split Down" },
  { action: UI_TOGGLE_OMNIBOX, shortcut: "Cmd+K",      label: "Command Palette" },
  // Cmd+1..9 for tab switching
  ...Array.from({ length: 9 }, (_, i) => ({
    action: SESSION_ACTIVATE,
    shortcut: `Cmd+${i + 1}`,
    label: `Switch to Tab ${i + 1}`,
  })),
];
```

### Service Layer (routing)

Services become **command routers** — they subscribe to commands on the EventBus, call features, and publish events:

```typescript
// domain.service.browsing — subscribes to session.* and nav.* commands

const BrowsingHandlersLive = Layer.effect(
  BrowsingHandlers,
  Effect.gen(function* () {
    const bus = yield* EventBus;
    const sessions = yield* SessionFeature;

    // Subscribe to commands and handle them
    yield* bus.commands.pipe(
      Stream.filter((cmd) => cmd.action.startsWith("session.") || cmd.action.startsWith("nav.")),
      Stream.runForEach((cmd) =>
        Effect.gen(function* () {
          switch (cmd.action) {
            case "session.create": {
              const session = yield* sessions.create("visual");
              yield* bus.publish({ type: "event", name: "session.created", payload: session, timestamp: Date.now(), causedBy: cmd.action });
              break;
            }
            case "session.close": {
              yield* sessions.remove(cmd.payload.id);
              yield* bus.publish({ type: "event", name: "session.closed", payload: cmd.payload, timestamp: Date.now(), causedBy: cmd.action });
              break;
            }
            // ...
          }
        }),
      ),
      Effect.forkScoped, // run in background
    );
  }),
);
```

### WebviewExecutor Port

```typescript
// core.ports.webview/src/index.ts

class WebviewExecutor extends Context.Tag("WebviewExecutor")<
  WebviewExecutor,
  {
    readonly createWebview: (opts: { url: string; hidden?: boolean }) => Effect.Effect<{ webviewId: string }>;
    readonly evaluateJs: (webviewId: string, script: string) => Effect.Effect<unknown>;
    readonly navigate: (webviewId: string, url: string) => Effect.Effect<void>;
    readonly closeWebview: (webviewId: string) => Effect.Effect<void>;
    readonly onEvent: (webviewId: string, event: string) => Stream.Stream<unknown>;
  }
>() {}
```

Implemented by `domain.adapter.electrobun` (using Electrobun's BrowserView API) or `domain.adapter.playwright` (future, for Mastra backend).

### UI Integration

UI components subscribe to events and dispatch commands:

```typescript
// Single hook for everything
function useEventBus() {
  const runtime = useRuntime();
  // ... setup scope, create EventBus client over RPC transport
  return {
    send: (action: string, payload?: unknown) => { /* dispatch command */ },
    useEvents: (name: string) => { /* reactive subscription to events */ },
  };
}

// In any component:
const { send, useEvents } = useEventBus();

// Dispatch
send("session.create", { mode: "visual" });

// Subscribe
const sessions = useEvents("session.*"); // reactive signal
```

### Agent Integration

An agent connects via the same RPC transport and dispatches commands:

```typescript
// Agent program — pure Effect, portable
const researchTask = Effect.gen(function* () {
  const bus = yield* EventBus;

  // Create hidden session
  yield* bus.send({ type: "command", action: "agent.create-headless", payload: { url: "example.com" } });

  // Wait for dom-ready event
  const ready = yield* bus.on("sys.dom-ready").pipe(Stream.take(1), Stream.runCollect);

  // Evaluate JS
  yield* bus.send({ type: "command", action: "agent.evaluate-js", payload: { sessionId: "...", script: "document.title" } });

  // Get result via event
  const result = yield* bus.on("agent.js-evaluated").pipe(Stream.take(1), Stream.runCollect);

  return result;
});
```

### EventBus Implementation

In-process implementation is just Effect PubSub:

```typescript
// core.ports.event-bus or core.shared

const EventBusLive = Layer.effect(
  EventBus,
  Effect.gen(function* () {
    const commandPub = yield* PubSub.unbounded<AppCommand>();
    const eventPub = yield* PubSub.unbounded<AppEvent>();

    return {
      send: (cmd) => PubSub.publish(commandPub, cmd),
      publish: (evt) => PubSub.publish(eventPub, evt),
      commands: Stream.fromPubSub(commandPub),
      events: Stream.fromPubSub(eventPub),
      on: (name) => Stream.fromPubSub(eventPub).pipe(
        Stream.filter((e) => e.name === name || e.name.startsWith(name.replace("*", ""))),
      ),
    };
  }),
);
```

The RPC bridge adapter carries EventBus messages across the Bun ↔ webview boundary using the existing RPC transport.

### Migration Path

1. **Phase 1: Add EventBus port + in-process impl** — new packages, no existing code changes
2. **Phase 2: Add shortcut registry + keyboard dispatch** — GlobalShortcut → EventBus commands
3. **Phase 3: Migrate BrowsingService to EventBus** — service subscribes to commands instead of direct RPC handlers
4. **Phase 4: Migrate WorkspaceService** — same pattern
5. **Phase 5: Deprecate old RPC groups** — consumers switch to EventBus dispatch
6. **Phase 6: Add agent commands** — WebviewExecutor port + headless session support

Each phase is a separate PR. Old and new coexist during transition via the deprecation fork pattern.

## Package Structure After Migration

```
core.ports.storage/       → SessionRepository, BookmarkRepository, etc.
core.ports.webview/       → WebviewExecutor
core.ports.event-bus/     → EventBus, AppCommand, AppEvent types
core.shared/              → schemas, errors, utilities, action catalog, shortcut registry
core.ui/                  → components, useEventBus hook

domain.feature.session/   → session logic (unchanged)
domain.feature.layout/    → layout logic (unchanged)
domain.feature.bookmark/  → bookmark logic (unchanged)
domain.feature.history/   → history logic (unchanged)

domain.service.browsing/  → command router for session.*, nav.*, bm.* commands
domain.service.workspace/ → command router for ws.* commands
domain.service.commander/ → command router for agent.*, ui.* commands

domain.adapter.db/        → implements core.ports.storage
domain.adapter.electrobun/ → implements core.ports.webview
domain.adapter.rpc/       → RPC transport + EventBus bridge
domain.adapter.otel/      → telemetry (subscribes to events for spans)
```

## Success Criteria

- Any operation can be triggered by keyboard shortcut, context menu, command palette, or agent
- Adding a new command requires: 1 action constant + 1 handler function (not 5-9 files)
- Agent can create headless sessions, navigate, evaluate JS, close — all via EventBus
- UI reactively updates from events without direct RPC subscriptions
- Existing functionality preserved during migration (old + new coexist)
