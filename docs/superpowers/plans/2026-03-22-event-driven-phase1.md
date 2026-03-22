# Event-Driven Architecture Phase 1: Ports + EventBus

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all ports into atomic `core.ports.*` packages, create EventBus port with in-process implementation, add command/event catalogs and shortcut registry.

**Architecture:** Ports move from `core.shared/model/ports.ts` into atomic packages (`core.ports.storage`, `core.ports.event-bus`). EventBus is a new port with `send(command)`, `publish(event)`, `on(name)` — implemented via Effect PubSub. Command catalog and shortcut registry live in `core.shared`. All 28 consumer files updated to import from new port packages. Old `ports.ts` deprecated.

**Tech Stack:** Effect (Context.Tag, PubSub, Stream, Layer), vitest

**Spec:** `docs/superpowers/specs/2026-03-22-event-driven-architecture-design.md`

---

## Task 1: Create `core.ports.storage` package

**Files:**
- Create: `packages/libs/core.ports.storage/package.json`
- Create: `packages/libs/core.ports.storage/tsconfig.json`
- Create: `packages/libs/core.ports.storage/src/index.ts`

Move all repository ports (SessionRepository, BookmarkRepository, HistoryRepository, LayoutRepository, DatabaseService) from `core.shared/model/ports.ts` into a dedicated package.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ctrl/core.ports.storage",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "check": "tsgo --noEmit" }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../../tsconfig.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Create src/index.ts**

Copy all repository Context.Tags from `core.shared/model/ports.ts`. The port file imports types from `core.shared` for `DatabaseError`, `Session`, `Page`, `Bookmark`, `HistoryEntry` — these stay in `core.shared` because they're schemas, not ports.

```typescript
import { Context, type Effect } from "effect";

// Import domain types from core.shared (schemas stay there)
// NOTE: These imports create a circular dependency concern.
// For Phase 1, re-declare the minimal types needed inline.
// Phase 2 will properly separate schemas from ports.

type DatabaseError = { readonly _tag: "DatabaseError" };
type Session = { readonly id: string; readonly pages: readonly { readonly url: string; readonly title: string | null; readonly loadedAt: string }[]; readonly currentIndex: number; readonly mode: "visual"; readonly isActive: boolean; readonly createdAt: string; readonly updatedAt: string };
type Page = { readonly url: string; readonly title: string | null; readonly loadedAt: string };
type Bookmark = { readonly id: string; readonly url: string; readonly title: string | null; readonly createdAt: string };
type HistoryEntry = { readonly id: string; readonly url: string; readonly title: string | null; readonly query: string | null; readonly visitedAt: string };

export class SessionRepository extends Context.Tag("SessionRepository")<
  SessionRepository,
  {
    readonly getAll: () => Effect.Effect<Session[], DatabaseError>;
    readonly getById: (id: string) => Effect.Effect<Session | undefined, DatabaseError>;
    readonly create: (mode: "visual") => Effect.Effect<Session, DatabaseError>;
    readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
    readonly setActive: (id: string) => Effect.Effect<void, DatabaseError>;
    readonly updateCurrentIndex: (id: string, index: number) => Effect.Effect<void, DatabaseError>;
    readonly addPage: (sessionId: string, url: string, atIndex: number) => Effect.Effect<Page, DatabaseError>;
    readonly removePagesAfterIndex: (sessionId: string, index: number) => Effect.Effect<void, DatabaseError>;
    readonly updatePageTitle: (sessionId: string, pageIndex: number, title: string) => Effect.Effect<void, DatabaseError>;
    readonly updatePageUrl: (sessionId: string, pageIndex: number, url: string) => Effect.Effect<void, DatabaseError>;
  }
>() {}

// ... BookmarkRepository, HistoryRepository, LayoutRepository, DatabaseService
```

**STOP** — this approach creates a problem. The ports reference domain types (`Session`, `Page`, `Bookmark`, `HistoryEntry`, `DatabaseError`) which live in `core.shared`. But `core.ports.*` is Level 1 (below `core.shared` Level 2). Level 1 can't import Level 2.

**Revised approach:** Ports use GENERIC types. The concrete types are bound at the adapter level.

Actually, looking at this more carefully — the current ports already use concrete types. Changing them to generics would break every consumer. Let me reconsider.

**Pragmatic approach for Phase 1:** Keep `core.ports.storage` at the SAME level as `core.shared` (both Level 2). They're peers, not hierarchical. The strict Level 1 separation is for `core.ports.event-bus` which genuinely has zero deps. Storage ports need `DatabaseError` and domain types.

```
Level 1: core.ports.event-bus  → zero deps (generic AppCommand/AppEvent)
Level 2: core.ports.storage    → depends on core.shared (for DatabaseError, Session, etc.)
Level 2: core.shared           → schemas, errors, utilities
Level 3: core.ui               → components, hooks
```

This is honest about the dependency reality.

---

Given the complexity of migrating 28 files, let me restructure this plan to be more incremental:

---

## Revised Plan Structure

Instead of moving ALL ports at once (risky, 28 files), we do:

1. **Task 1:** Create `core.ports.event-bus` (Level 1, zero deps) — NEW package
2. **Task 2:** Create EventBusLive implementation with tests
3. **Task 3:** Add command catalog to `core.shared`
4. **Task 4:** Add shortcut registry to `core.shared`
5. **Task 5:** Re-export storage ports from `core.shared` (no migration yet — deferred to Phase 2)

The storage port extraction is deferred because it touches 28 files and doesn't block EventBus work. EventBus port is the priority.

---

## Task 1: Create `core.ports.event-bus` package

**Files:**
- Create: `packages/libs/core.ports.event-bus/package.json`
- Create: `packages/libs/core.ports.event-bus/tsconfig.json`
- Create: `packages/libs/core.ports.event-bus/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ctrl/core.ports.event-bus",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "check": "tsgo --noEmit" }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../../tsconfig.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Create src/index.ts with types + port**

```typescript
import { Context, type Effect, type Stream } from "effect";

// --- Command & Event types ---

export type CommandSource = "keyboard" | "menu" | "agent" | "ui" | "system";

export type AppCommand = {
  readonly type: "command";
  readonly action: string;
  readonly payload?: unknown;
  readonly meta?: { readonly source: CommandSource };
};

export type AppEvent = {
  readonly type: "event";
  readonly name: string;
  readonly payload?: unknown;
  readonly timestamp: number;
  readonly causedBy?: string;
};

// --- EventBus port ---

export const EVENT_BUS_ID = "EventBus" as const;

export class EventBus extends Context.Tag(EVENT_BUS_ID)<
  EventBus,
  {
    readonly send: (command: AppCommand) => Effect.Effect<void>;
    readonly publish: (event: AppEvent) => Effect.Effect<void>;
    readonly commands: Stream.Stream<AppCommand>;
    readonly events: Stream.Stream<AppEvent>;
    readonly on: (eventName: string) => Stream.Stream<AppEvent>;
  }
>() {}
```

- [ ] **Step 4: Run `bun install` and typecheck**

```bash
bun install
cd packages/libs/core.ports.event-bus && bunx tsgo --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add packages/libs/core.ports.event-bus
git commit -m "feat: core.ports.event-bus — EventBus port with AppCommand/AppEvent types"
```

---

## Task 2: Create EventBusLive implementation with tests

**Files:**
- Create: `packages/libs/core.ports.event-bus/src/event-bus.live.ts`
- Create: `packages/libs/core.ports.event-bus/src/event-bus.live.test.ts`
- Modify: `packages/libs/core.ports.event-bus/src/index.ts` (add export)
- Modify: `packages/libs/core.ports.event-bus/package.json` (add test script)

- [ ] **Step 1: Add test script to package.json**

Add `"test": "vitest run"` to scripts.

- [ ] **Step 2: Write tests**

```typescript
// src/event-bus.live.test.ts
import { Chunk, Duration, Effect, Fiber, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { type AppCommand, type AppEvent, EventBus } from "./index";
import { EventBusLive } from "./event-bus.live";

const runTest = <A, E>(effect: Effect.Effect<A, E, EventBus>) =>
  Effect.runPromise(effect.pipe(Effect.provide(EventBusLive)));

describe("EventBusLive", () => {
  it("send command → commands stream receives it", async () => {
    await runTest(
      Effect.gen(function* () {
        const bus = yield* EventBus;
        const fiber = yield* bus.commands.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
        yield* Effect.sleep(Duration.millis(10));
        yield* bus.send({ type: "command", action: "test.action" });
        const collected = yield* Fiber.join(fiber);
        const items = Chunk.toArray(collected);
        expect(items).toHaveLength(1);
        expect(items[0].action).toBe("test.action");
      }),
    );
  });

  it("publish event → events stream receives it", async () => {
    await runTest(
      Effect.gen(function* () {
        const bus = yield* EventBus;
        const fiber = yield* bus.events.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
        yield* Effect.sleep(Duration.millis(10));
        yield* bus.publish({ type: "event", name: "test.happened", timestamp: Date.now() });
        const collected = yield* Fiber.join(fiber);
        const items = Chunk.toArray(collected);
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe("test.happened");
      }),
    );
  });

  it("on(name) filters events by name", async () => {
    await runTest(
      Effect.gen(function* () {
        const bus = yield* EventBus;
        const fiber = yield* bus.on("session.created").pipe(Stream.take(1), Stream.runCollect, Effect.fork);
        yield* Effect.sleep(Duration.millis(10));
        yield* bus.publish({ type: "event", name: "other.event", timestamp: Date.now() });
        yield* bus.publish({ type: "event", name: "session.created", timestamp: Date.now(), payload: { id: "s1" } });
        const collected = yield* Fiber.join(fiber);
        const items = Chunk.toArray(collected);
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe("session.created");
      }),
    );
  });

  it("on(prefix.*) filters events by prefix", async () => {
    await runTest(
      Effect.gen(function* () {
        const bus = yield* EventBus;
        const fiber = yield* bus.on("session.*").pipe(Stream.take(2), Stream.runCollect, Effect.fork);
        yield* Effect.sleep(Duration.millis(10));
        yield* bus.publish({ type: "event", name: "nav.navigated", timestamp: Date.now() });
        yield* bus.publish({ type: "event", name: "session.created", timestamp: Date.now() });
        yield* bus.publish({ type: "event", name: "session.closed", timestamp: Date.now() });
        const collected = yield* Fiber.join(fiber);
        const items = Chunk.toArray(collected);
        expect(items).toHaveLength(2);
        expect(items[0].name).toBe("session.created");
        expect(items[1].name).toBe("session.closed");
      }),
    );
  });

  it("command carries payload and meta", async () => {
    await runTest(
      Effect.gen(function* () {
        const bus = yield* EventBus;
        const fiber = yield* bus.commands.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
        yield* Effect.sleep(Duration.millis(10));
        yield* bus.send({ type: "command", action: "session.create", payload: { mode: "visual" }, meta: { source: "keyboard" } });
        const collected = yield* Fiber.join(fiber);
        const items = Chunk.toArray(collected);
        expect(items[0].payload).toEqual({ mode: "visual" });
        expect(items[0].meta?.source).toBe("keyboard");
      }),
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
bunx vitest run packages/libs/core.ports.event-bus
```
Expected: FAIL (EventBusLive doesn't exist yet)

- [ ] **Step 4: Implement EventBusLive**

```typescript
// src/event-bus.live.ts
import { Effect, Layer, PubSub, Stream } from "effect";
import { type AppCommand, type AppEvent, EventBus } from "./index";

export const EventBusLive = Layer.effect(
  EventBus,
  Effect.gen(function* () {
    const commandPub = yield* PubSub.unbounded<AppCommand>();
    const eventPub = yield* PubSub.unbounded<AppEvent>();

    return {
      send: (cmd: AppCommand) => PubSub.publish(commandPub, cmd).pipe(Effect.asVoid),
      publish: (evt: AppEvent) => PubSub.publish(eventPub, evt).pipe(Effect.asVoid),
      commands: Stream.fromPubSub(commandPub),
      events: Stream.fromPubSub(eventPub),
      on: (name: string) => {
        const isWildcard = name.endsWith(".*");
        const prefix = isWildcard ? name.slice(0, -1) : null;
        return Stream.fromPubSub(eventPub).pipe(
          Stream.filter((e) => prefix ? e.name.startsWith(prefix) : e.name === name),
        );
      },
    };
  }),
);
```

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { EventBusLive } from "./event-bus.live";
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
bunx vitest run packages/libs/core.ports.event-bus
```
Expected: 5 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/libs/core.ports.event-bus
git commit -m "feat: EventBusLive implementation with PubSub + 5 tests"
```

---

## Task 3: Add command catalog to `core.shared`

**Files:**
- Create: `packages/libs/core.shared/src/model/actions.ts`
- Modify: `packages/libs/core.shared/src/index.ts`

- [ ] **Step 1: Create actions catalog**

```typescript
// src/model/actions.ts

// Session commands
export const SESSION_CREATE = "session.create" as const;
export const SESSION_CLOSE = "session.close" as const;
export const SESSION_ACTIVATE = "session.activate" as const;

// Navigation commands
export const NAV_NAVIGATE = "nav.navigate" as const;
export const NAV_BACK = "nav.back" as const;
export const NAV_FORWARD = "nav.forward" as const;
export const NAV_REPORT = "nav.report" as const;
export const NAV_UPDATE_TITLE = "nav.update-title" as const;

// Workspace commands
export const WS_SPLIT_RIGHT = "ws.split-right" as const;
export const WS_SPLIT_DOWN = "ws.split-down" as const;
export const WS_CLOSE_PANE = "ws.close-pane" as const;
export const WS_FOCUS_PANE = "ws.focus-pane" as const;

// Bookmark commands
export const BM_ADD = "bm.add" as const;
export const BM_REMOVE = "bm.remove" as const;
export const BM_IS_BOOKMARKED = "bm.is-bookmarked" as const;

// History commands
export const HIST_GET_ALL = "hist.get-all" as const;
export const HIST_CLEAR = "hist.clear" as const;

// Agent commands
export const AGENT_CREATE_HEADLESS = "agent.create-headless" as const;
export const AGENT_EVALUATE_JS = "agent.evaluate-js" as const;
export const AGENT_CLOSE_HEADLESS = "agent.close-headless" as const;

// UI commands
export const UI_TOGGLE_OMNIBOX = "ui.toggle-omnibox" as const;
export const UI_TOGGLE_SIDEBAR = "ui.toggle-sidebar" as const;

// --- Event names ---

export const EVT_SESSION_CREATED = "session.created" as const;
export const EVT_SESSION_CLOSED = "session.closed" as const;
export const EVT_SESSION_ACTIVATED = "session.activated" as const;
export const EVT_NAVIGATED = "nav.navigated" as const;
export const EVT_TITLE_UPDATED = "nav.title-updated" as const;
export const EVT_LAYOUT_CHANGED = "ws.layout-changed" as const;
export const EVT_PANE_SPLIT = "ws.pane-split" as const;
export const EVT_BOOKMARK_ADDED = "bm.added" as const;
export const EVT_BOOKMARK_REMOVED = "bm.removed" as const;
export const EVT_HISTORY_RECORDED = "hist.recorded" as const;
export const EVT_HISTORY_CLEARED = "hist.cleared" as const;

// System events (from Electrobun IPC)
export const EVT_SYS_DOM_READY = "sys.dom-ready" as const;
export const EVT_SYS_DID_NAVIGATE = "sys.did-navigate" as const;
```

- [ ] **Step 2: Export from core.shared index**

Add to `src/index.ts`:
```typescript
export * from "./model/actions";
```

- [ ] **Step 3: Commit**

```bash
git add packages/libs/core.shared/src/model/actions.ts packages/libs/core.shared/src/index.ts
git commit -m "feat: command and event catalog in core.shared"
```

---

## Task 4: Add shortcut registry to `core.shared`

**Files:**
- Create: `packages/libs/core.shared/src/model/shortcuts.ts`
- Modify: `packages/libs/core.shared/src/index.ts`

- [ ] **Step 1: Create shortcuts registry**

```typescript
// src/model/shortcuts.ts
import {
  SESSION_CREATE, SESSION_CLOSE, SESSION_ACTIVATE,
  NAV_BACK, NAV_FORWARD,
  WS_SPLIT_RIGHT, WS_SPLIT_DOWN,
  UI_TOGGLE_OMNIBOX,
} from "./actions";

export type ShortcutBinding = {
  readonly action: string;
  readonly shortcut: string;
  readonly label: string;
  readonly when?: string;
};

export const DEFAULT_SHORTCUTS: readonly ShortcutBinding[] = [
  { action: SESSION_CREATE, shortcut: "Cmd+T", label: "New Tab" },
  { action: SESSION_CLOSE, shortcut: "Cmd+W", label: "Close Tab" },
  { action: NAV_BACK, shortcut: "Cmd+[", label: "Back" },
  { action: NAV_FORWARD, shortcut: "Cmd+]", label: "Forward" },
  { action: WS_SPLIT_RIGHT, shortcut: "Cmd+D", label: "Split Right" },
  { action: WS_SPLIT_DOWN, shortcut: "Cmd+Shift+D", label: "Split Down" },
  { action: UI_TOGGLE_OMNIBOX, shortcut: "Cmd+K", label: "Command Palette" },
  ...Array.from({ length: 9 }, (_, i) => ({
    action: SESSION_ACTIVATE,
    shortcut: `Cmd+${i + 1}`,
    label: `Switch to Tab ${i + 1}`,
  })),
] as const;
```

- [ ] **Step 2: Export from core.shared index**

Add to `src/index.ts`:
```typescript
export * from "./model/shortcuts";
```

- [ ] **Step 3: Commit**

```bash
git add packages/libs/core.shared/src/model/shortcuts.ts packages/libs/core.shared/src/index.ts
git commit -m "feat: shortcut registry with default keyboard bindings"
```

---

## Task 5: Wire EventBus into desktop app layer stack

**Files:**
- Modify: `packages/apps/desktop/src/bun/layers.ts`
- Modify: `packages/apps/desktop/package.json`

- [ ] **Step 1: Add dependency**

Add `"@ctrl/core.ports.event-bus": "workspace:*"` to `packages/apps/desktop/package.json` dependencies.

- [ ] **Step 2: Add EventBusLive to layer stack**

In `layers.ts`, import and add:
```typescript
import { EventBusLive } from "@ctrl/core.ports.event-bus";

// Add to DesktopLive composition:
export const DesktopLive = Layer.mergeAll(
  DbClientLive,
  TracedBrowsingLayer,
  TracedWorkspaceLayer,
  EventBusLive,
);
```

- [ ] **Step 3: Run typecheck**

```bash
bunx --bun turbo check
```

- [ ] **Step 4: Run all tests**

```bash
bunx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add packages/apps/desktop
git commit -m "feat: wire EventBusLive into desktop app layer stack"
```

---

## Task 6: Deprecate old ports location (mark, don't delete)

**Files:**
- Modify: `packages/libs/core.shared/src/model/ports.ts`

- [ ] **Step 1: Add deprecation notice**

Add JSDoc to the top of `ports.ts`:
```typescript
/**
 * @deprecated These ports will move to `@ctrl/core.ports.storage` in Phase 2.
 * New code should prepare for the migration but continue importing from here for now.
 * See: docs/superpowers/specs/2026-03-22-event-driven-architecture-design.md
 */
```

- [ ] **Step 2: Commit**

```bash
git add packages/libs/core.shared/src/model/ports.ts
git commit -m "docs: mark ports.ts as deprecated, migration planned for Phase 2"
```
