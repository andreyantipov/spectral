# Event-Driven v2 Phase 2: EventLog Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace dual RPC+EventBus paths with a single EventLog-based path: UI → useApi() → EventLog → features → events → UI.

**Architecture:** EventGroup definitions in core.port.event-bus define typed events. EventLog handlers in domain.service.browsing route events to features. useApi() in core.ui.api provides typed client for UI. Old RPC layer (BrowsingRpcs, command-router, ops) deleted.

**Tech Stack:** `@effect/experimental@0.58.0` (EventGroup, EventLog), Effect, `@effect/sql` Model.Class, SolidJS, Bun

**Spec:** `docs/superpowers/specs/2026-03-22-event-driven-v2-phase2-design.md`

---

## File Structure

### New files to create

```
packages/libs/core.port.event-bus/src/
  groups/
    session.ts            → SessionEvents EventGroup
    navigation.ts         → NavigationEvents EventGroup
    bookmark.ts           → BookmarkEvents EventGroup
    schema.ts             → AppEvents = EventLog.schema(...)
  groups.test.ts          → Unit tests for EventGroup/EventLog API at 0.58.0

packages/libs/core.ui.api/src/
  use-api.ts              → useApi() hook — typed client over EventLog
  api-provider.tsx        → <ApiProvider> context for EventLog client

packages/libs/domain.service.browsing/src/api/
  browsing.eventlog.ts    → EventLog.group() handlers (replaces browsing.handlers.ts)
  browsing.eventlog.test.ts → Tests for EventLog handlers
```

### Files to modify

```
packages/libs/core.port.event-bus/src/index.ts     → export groups, remove old signals
packages/libs/core.port.event-bus/package.json     → add @effect/experimental dep
packages/libs/core.ui.api/src/index.ts             → export useApi, ApiProvider
packages/libs/core.ui.api/package.json             → add deps
packages/libs/domain.service.browsing/src/index.ts → export EventLog handlers
packages/libs/domain.service.browsing/package.json → add @effect/experimental dep
packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx → use useApi() instead of useBrowsingRpc()
packages/apps/desktop/src/bun/layers.ts            → wire EventLog instead of BrowsingHandlersLive
packages/apps/desktop/src/bun/index.ts             → remove command-router setup
```

### Files to delete (after migration)

```
packages/apps/desktop/src/bun/command-router.ts
packages/libs/domain.service.browsing/src/api/browsing.handlers.ts
packages/libs/domain.service.browsing/src/api/browsing.rpc.ts
packages/libs/core.port.event-bus/src/signals/       → all signal files (replaced by groups/)
packages/libs/core.port.event-bus/src/shortcuts.ts   → shortcuts move into groups or stay
packages/libs/core.shared/src/model/actions.ts       → action constants replaced by event tags
packages/libs/core.ports.event-bus/                  → dead directory
```

---

## Task 1: Verify EventGroup/EventLog API works at 0.58.0

**Files:**
- Create: `packages/libs/core.port.event-bus/src/groups.test.ts`
- Modify: `packages/libs/core.port.event-bus/package.json`

- [ ] **Step 1: Add @effect/experimental dependency**

In `packages/libs/core.port.event-bus/package.json`, add to dependencies:
```json
"dependencies": {
  "@effect/experimental": "0.58.0"
}
```

- [ ] **Step 2: Write smoke test for EventGroup + EventLog**

`packages/libs/core.port.event-bus/src/groups.test.ts`:
```typescript
import { EventGroup, EventLog } from "@effect/experimental"
import { Effect, Schema } from "effect"
import { describe, expect, it } from "vitest"

describe("EventGroup/EventLog API at 0.58.0", () => {
	const TestEvents = EventGroup.empty.add({
		tag: "test.greet",
		primaryKey: () => "global",
		payload: Schema.Struct({ name: Schema.String }),
		success: Schema.String,
	})

	it("EventGroup.empty creates a group", () => {
		expect(TestEvents).toBeDefined()
		expect(TestEvents.events).toBeDefined()
	})

	it("EventLog.schema creates a schema from groups", () => {
		const schema = EventLog.schema(TestEvents)
		expect(schema).toBeDefined()
	})

	it("EventLog.group creates exhaustive handlers", () => {
		const handlers = EventLog.group(TestEvents, (h) =>
			h.handle("test.greet", ({ payload }) =>
				Effect.succeed(`Hello, ${payload.name}!`),
			),
		)
		expect(handlers).toBeDefined()
	})
})
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/me/Developer/Spectral && bunx vitest run packages/libs/core.port.event-bus/src/groups.test.ts`
Expected: PASS — 3 tests pass, confirming API works at 0.58.0

- [ ] **Step 4: Commit**

```bash
git add packages/libs/core.port.event-bus/package.json packages/libs/core.port.event-bus/src/groups.test.ts
git commit -m "test: verify EventGroup/EventLog API works at @effect/experimental@0.58.0"
```

---

## Task 2: Create EventGroup definitions

**Files:**
- Create: `packages/libs/core.port.event-bus/src/groups/session.ts`
- Create: `packages/libs/core.port.event-bus/src/groups/navigation.ts`
- Create: `packages/libs/core.port.event-bus/src/groups/bookmark.ts`
- Create: `packages/libs/core.port.event-bus/src/groups/schema.ts`
- Modify: `packages/libs/core.port.event-bus/src/index.ts`

**Docs to check:** `@effect/experimental` EventGroup.add() signature — `tag`, `primaryKey`, `payload`, `success`, `error` fields.

- [ ] **Step 1: Write SessionEvents group**

`packages/libs/core.port.event-bus/src/groups/session.ts`:
```typescript
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
		success: Schema.Void,
	})
	.add({
		tag: "session.activate",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String }),
		success: Schema.Void,
	})
```

- [ ] **Step 2: Write NavigationEvents group**

`packages/libs/core.port.event-bus/src/groups/navigation.ts`:
```typescript
import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"
import { Session } from "@ctrl/core.base.model"

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
		success: Schema.Void,
	})
	.add({
		tag: "nav.update-title",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String, title: Schema.String }),
		success: Schema.Void,
	})
```

- [ ] **Step 3: Write BookmarkEvents group**

`packages/libs/core.port.event-bus/src/groups/bookmark.ts`:
```typescript
import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"
import { Bookmark } from "@ctrl/core.base.model"

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
		success: Schema.Void,
	})
```

- [ ] **Step 4: Write AppEvents schema**

`packages/libs/core.port.event-bus/src/groups/schema.ts`:
```typescript
import { EventLog } from "@effect/experimental"
import { BookmarkEvents } from "./bookmark"
import { NavigationEvents } from "./navigation"
import { SessionEvents } from "./session"

export const AppEvents = EventLog.schema(SessionEvents, NavigationEvents, BookmarkEvents)
```

- [ ] **Step 5: Add core.base.model dependency to package.json**

In `packages/libs/core.port.event-bus/package.json`, add:
```json
"dependencies": {
  "@effect/experimental": "0.58.0",
  "@ctrl/core.base.model": "workspace:*"
}
```

- [ ] **Step 6: Export groups from barrel**

Add to `packages/libs/core.port.event-bus/src/index.ts`:
```typescript
export { SessionEvents } from "./groups/session"
export { NavigationEvents } from "./groups/navigation"
export { BookmarkEvents } from "./groups/bookmark"
export { AppEvents } from "./groups/schema"
```

- [ ] **Step 7: Write tests for groups**

Add to `packages/libs/core.port.event-bus/src/groups.test.ts`:
```typescript
import { SessionEvents, NavigationEvents, BookmarkEvents, AppEvents } from "./groups/schema"
// ... re-export test
import { SessionEvents as SE } from "./groups/session"

describe("App EventGroups", () => {
	it("SessionEvents has 3 events", () => {
		expect(Object.keys(SE.events)).toHaveLength(3)
		expect(SE.events["session.create"]).toBeDefined()
		expect(SE.events["session.close"]).toBeDefined()
		expect(SE.events["session.activate"]).toBeDefined()
	})

	it("NavigationEvents has 5 events", () => {
		const { NavigationEvents: NE } = require("./groups/navigation")
		expect(Object.keys(NE.events)).toHaveLength(5)
	})

	it("AppEvents schema combines all groups", () => {
		expect(AppEvents).toBeDefined()
	})
})
```

- [ ] **Step 8: Run tests + type check**

Run: `bunx vitest run packages/libs/core.port.event-bus && bun run check`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/libs/core.port.event-bus
git commit -m "feat: add EventGroup definitions — SessionEvents, NavigationEvents, BookmarkEvents"
```

---

## Task 3: Create EventLog handlers in domain.service.browsing

**Files:**
- Create: `packages/libs/domain.service.browsing/src/api/browsing.eventlog.ts`
- Create: `packages/libs/domain.service.browsing/src/api/browsing.eventlog.test.ts`
- Modify: `packages/libs/domain.service.browsing/package.json`
- Modify: `packages/libs/domain.service.browsing/src/index.ts`

- [ ] **Step 1: Add @effect/experimental dependency**

In `packages/libs/domain.service.browsing/package.json`, add `"@effect/experimental": "0.58.0"` to dependencies.

- [ ] **Step 2: Write EventLog handlers**

`packages/libs/domain.service.browsing/src/api/browsing.eventlog.ts`:
```typescript
import { EventLog } from "@effect/experimental"
import { withTracing } from "@ctrl/core.base.tracing"
import {
	BookmarkEvents,
	NavigationEvents,
	SessionEvents,
} from "@ctrl/core.port.event-bus"
import { Effect } from "effect"

// Session handlers
export const SessionHandlers = EventLog.group(SessionEvents, (h) =>
	h
		.handle("session.create", ({ payload }) =>
			Effect.gen(function* () {
				const { SessionFeature } = yield* import("@ctrl/domain.feature.session")
				const sessions = yield* SessionFeature
				const session = yield* sessions.create(payload.mode)
				yield* sessions.setActive(session.id)
				return session
			}).pipe(withTracing("BrowsingService", "session.create")),
		)
		.handle("session.close", ({ payload }) =>
			Effect.gen(function* () {
				const { SessionFeature } = yield* import("@ctrl/domain.feature.session")
				const sessions = yield* SessionFeature
				yield* sessions.remove(payload.id)
			}).pipe(withTracing("BrowsingService", "session.close")),
		)
		.handle("session.activate", ({ payload }) =>
			Effect.gen(function* () {
				const { SessionFeature } = yield* import("@ctrl/domain.feature.session")
				const sessions = yield* SessionFeature
				yield* sessions.setActive(payload.id)
			}).pipe(withTracing("BrowsingService", "session.activate")),
		),
)

// Navigation handlers
export const NavigationHandlers = EventLog.group(NavigationEvents, (h) =>
	h
		.handle("nav.navigate", ({ payload }) =>
			Effect.gen(function* () {
				const { SessionFeature } = yield* import("@ctrl/domain.feature.session")
				const { OmniboxFeature } = yield* import("@ctrl/domain.feature.omnibox")
				const sessions = yield* SessionFeature
				const omnibox = yield* OmniboxFeature
				const resolved = yield* omnibox.resolve(payload.input)
				const session = yield* sessions.navigate(payload.id, resolved.url)
				return session
			}).pipe(withTracing("BrowsingService", "nav.navigate")),
		)
		.handle("nav.back", ({ payload }) =>
			Effect.gen(function* () {
				const { SessionFeature } = yield* import("@ctrl/domain.feature.session")
				const sessions = yield* SessionFeature
				return yield* sessions.goBack(payload.id)
			}).pipe(withTracing("BrowsingService", "nav.back")),
		)
		.handle("nav.forward", ({ payload }) =>
			Effect.gen(function* () {
				const { SessionFeature } = yield* import("@ctrl/domain.feature.session")
				const sessions = yield* SessionFeature
				return yield* sessions.goForward(payload.id)
			}).pipe(withTracing("BrowsingService", "nav.forward")),
		)
		.handle("nav.report", ({ payload }) =>
			Effect.gen(function* () {
				const { SessionFeature } = yield* import("@ctrl/domain.feature.session")
				const sessions = yield* SessionFeature
				yield* sessions.updateUrl(payload.id, payload.url)
			}).pipe(withTracing("BrowsingService", "nav.report")),
		)
		.handle("nav.update-title", ({ payload }) =>
			Effect.gen(function* () {
				const { SessionFeature } = yield* import("@ctrl/domain.feature.session")
				const sessions = yield* SessionFeature
				yield* sessions.updateTitle(payload.id, payload.title)
			}).pipe(withTracing("BrowsingService", "nav.update-title")),
		),
)

// Bookmark handlers
export const BookmarkHandlers = EventLog.group(BookmarkEvents, (h) =>
	h
		.handle("bm.add", ({ payload }) =>
			Effect.gen(function* () {
				const { BookmarkFeature } = yield* import("@ctrl/domain.feature.bookmark")
				const bookmarks = yield* BookmarkFeature
				return yield* bookmarks.create(payload.url, payload.title)
			}).pipe(withTracing("BrowsingService", "bm.add")),
		)
		.handle("bm.remove", ({ payload }) =>
			Effect.gen(function* () {
				const { BookmarkFeature } = yield* import("@ctrl/domain.feature.bookmark")
				const bookmarks = yield* BookmarkFeature
				yield* bookmarks.remove(payload.id)
			}).pipe(withTracing("BrowsingService", "bm.remove")),
		),
)
```

**Note:** The dynamic imports `yield* import(...)` pattern above is pseudocode. The actual implementation will use static imports and `yield*` on Context.Tags directly (e.g., `yield* SessionFeature`). The exact pattern depends on how SessionFeature is exported — check `packages/libs/domain.feature.session/src/index.ts` during implementation.

- [ ] **Step 3: Export from barrel**

Add to `packages/libs/domain.service.browsing/src/index.ts`:
```typescript
export { BookmarkHandlers, NavigationHandlers, SessionHandlers } from "./api/browsing.eventlog"
```

- [ ] **Step 4: Run type check**

Run: `bun run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/libs/domain.service.browsing
git commit -m "feat: EventLog handlers for session, navigation, bookmark"
```

---

## Task 4: Build useApi() in core.ui.api

**Files:**
- Create: `packages/libs/core.ui.api/src/use-api.ts`
- Modify: `packages/libs/core.ui.api/src/index.ts`
- Modify: `packages/libs/core.ui.api/package.json`

This is the typed client that UI components use. It wraps EventBus.send() with typed payloads from EventGroup definitions, and EventBus.on() for reactive subscriptions.

- [ ] **Step 1: Add dependencies**

In `packages/libs/core.ui.api/package.json`, add:
```json
"dependencies": {
  "@ctrl/core.port.event-bus": "workspace:*",
  "@ctrl/core.base.model": "workspace:*",
  "@effect/experimental": "0.58.0"
}
```

- [ ] **Step 2: Write useApi() hook**

`packages/libs/core.ui.api/src/use-api.ts`:

The hook creates a typed API object from EventGroup definitions. Each event tag becomes a method on the API. Implementation uses `useRuntime()` to get the ManagedRuntime, then wraps EventBus.send() calls.

```typescript
import {
	type AppCommand,
	EventBus,
	SessionEvents,
	NavigationEvents,
	BookmarkEvents,
} from "@ctrl/core.port.event-bus"
import { useRuntime } from "./runtime-provider"

export function useApi() {
	const runtime = useRuntime()

	const send = (action: string, payload?: unknown) =>
		runtime.runPromise(
			EventBus.pipe(
				Effect.flatMap((bus) =>
					bus.send({
						type: "command",
						action,
						payload,
						meta: { source: "ui" },
					}),
				),
			),
		)

	return {
		session: {
			create: (payload: { mode: "visual" }) => send("session.create", payload),
			close: (payload: { id: string }) => send("session.close", payload),
			activate: (payload: { id: string }) => send("session.activate", payload),
		},
		nav: {
			navigate: (payload: { id: string; input: string }) => send("nav.navigate", payload),
			back: (payload: { id: string }) => send("nav.back", payload),
			forward: (payload: { id: string }) => send("nav.forward", payload),
			report: (payload: { id: string; url: string }) => send("nav.report", payload),
			updateTitle: (payload: { id: string; title: string }) => send("nav.update-title", payload),
		},
		bm: {
			add: (payload: { url: string; title: string | null }) => send("bm.add", payload),
			remove: (payload: { id: string }) => send("bm.remove", payload),
		},
	}
}
```

**Note:** This is a first-pass implementation. The types are manually mirrored from EventGroup — in a future iteration, they can be auto-generated from the EventGroup type using TypeScript inference. For now, manual typing ensures correctness and is easy to verify.

- [ ] **Step 3: Export from barrel**

Update `packages/libs/core.ui.api/src/index.ts`:
```typescript
export { useApi } from "./use-api"
export { useEventBus } from "./use-event-bus"
export { RuntimeContext, useRuntime } from "./runtime-provider"
```

- [ ] **Step 4: Run type check**

Run: `bun run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/libs/core.ui.api
git commit -m "feat: useApi() hook — typed EventBus client for UI"
```

---

## Task 5: Migrate SidebarFeature to useApi()

**Files:**
- Modify: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx`
- Modify: `packages/libs/ui.feature.sidebar/package.json`

This is the critical migration — replace all `client.navigate()`, `client.createSession()`, etc. with `api.session.create()`, `api.nav.navigate()`, etc.

- [ ] **Step 1: Add core.ui.api dependency**

In `packages/libs/ui.feature.sidebar/package.json`, add `"@ctrl/core.ui.api": "workspace:*"` to dependencies.

- [ ] **Step 2: Replace useBrowsingRpc with useApi**

In `SidebarFeature.tsx`:
- Replace `const { client, state } = useBrowsingRpc()` with `const api = useApi()`
- State subscription needs to stay via existing mechanism (browsingChanges stream) until EventLog provides a reactive state subscription. For now, keep the RPC state stream alongside useApi() commands. This will be cleaned up when EventLog's event subscription is wired.

Replace the `ops` object:
```typescript
// OLD:
const ops = withWebTracing(SIDEBAR_FEATURE, {
  navigate: (input) => runtime.runPromise(client.navigate({ id, input })),
  createSession: () => runtime.runPromise(client.createSession({ mode: "visual" })),
  // ...
})

// NEW:
const ops = withWebTracing(SIDEBAR_FEATURE, {
  navigate: (input) => api.nav.navigate({ id: activeSessionId(), input }),
  createSession: () => api.session.create({ mode: "visual" }),
  switchSession: (id) => api.session.activate({ id }),
  closeSession: (id) => api.session.close({ id }),
  reportNavigation: (sessionId, url) => api.nav.report({ id: sessionId, url }),
  updateTitle: (sessionId, title) => api.nav.updateTitle({ id: sessionId, title }),
})
```

- [ ] **Step 3: Run type check + tests**

Run: `bun run check && bun run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/libs/ui.feature.sidebar
git commit -m "refactor: SidebarFeature uses useApi() instead of direct RPC"
```

---

## Task 6: Wire EventLog handlers in layers.ts

**Files:**
- Modify: `packages/apps/desktop/src/bun/layers.ts`
- Modify: `packages/apps/desktop/src/bun/index.ts`

- [ ] **Step 1: Update layers.ts to use EventLog handlers**

Replace BrowsingHandlersLive with SessionHandlers + NavigationHandlers + BookmarkHandlers in the layer composition. The exact wiring depends on how EventLog integrates with the Layer system — check `EventLog` API for `toLayer()` or similar.

- [ ] **Step 2: Update index.ts — remove command-router**

In `packages/apps/desktop/src/bun/index.ts`:
- Remove `import { startCommandRouter } from "./command-router"`
- Remove `startCommandRouter(runtime)` call
- EventLog handlers are started via Layer, not manually

- [ ] **Step 3: Run full test suite + build**

Run: `bun run test && bun run check`
Expected: PASS

- [ ] **Step 4: Smoke test**

Start the app: `bun run dev:desktop:agentic`
Test: Cmd+T (new tab), type URL + Enter (navigate), Cmd+W (close tab)
All should work through EventLog path.

- [ ] **Step 5: Commit**

```bash
git add packages/apps/desktop
git commit -m "refactor: wire EventLog handlers, remove command-router"
```

---

## Task 7: Delete old code

**Files to delete:**
- `packages/apps/desktop/src/bun/command-router.ts`
- `packages/libs/domain.service.browsing/src/api/browsing.handlers.ts`
- `packages/libs/domain.service.browsing/src/api/browsing.rpc.ts`
- `packages/libs/domain.service.browsing/src/api/browsing.service.test.ts` (if RPC-specific)
- `packages/libs/core.port.event-bus/src/signals/` (all signal files)
- `packages/libs/core.shared/src/model/actions.ts`
- `packages/libs/core.ports.event-bus/` (dead directory)

- [ ] **Step 1: Delete old RPC handlers + command router**

```bash
rm packages/apps/desktop/src/bun/command-router.ts
rm packages/libs/domain.service.browsing/src/api/browsing.handlers.ts
rm packages/libs/domain.service.browsing/src/api/browsing.rpc.ts
```

- [ ] **Step 2: Delete old signal files**

```bash
rm -rf packages/libs/core.port.event-bus/src/signals/
```

- [ ] **Step 3: Delete dead core.ports.event-bus directory**

```bash
rm -rf packages/libs/core.ports.event-bus/
```

- [ ] **Step 4: Remove action constants from core.shared**

Delete `packages/libs/core.shared/src/model/actions.ts` and remove its export from `packages/libs/core.shared/src/index.ts`.

- [ ] **Step 5: Update all imports that referenced deleted files**

Search for any remaining imports of deleted modules and update or remove them.

- [ ] **Step 6: Run full test suite + type check + grit**

Run: `bun run test && bun run check && bunx grit check .`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: delete old RPC handlers, command-router, signal files, action constants"
```

---

## Summary

| Task | What | Depends on |
|------|------|-----------|
| 1 | Verify EventGroup/EventLog API at 0.58.0 | — |
| 2 | Create EventGroup definitions | Task 1 |
| 3 | Create EventLog handlers | Task 2 |
| 4 | Build useApi() hook | Task 2 |
| 5 | Migrate SidebarFeature to useApi() | Tasks 3, 4 |
| 6 | Wire EventLog in layers, remove command-router | Tasks 3, 5 |
| 7 | Delete old code | Task 6 |

Tasks 3 and 4 can be parallelized. Total: 7 tasks.
