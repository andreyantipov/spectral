# Phase 1: Core Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split monolithic `core.shared` into `core.base.*` packages, rename `core.ports.*` → `core.port.*`, move typed signal definitions into `core.port.event-bus`, and split `core.ui` into `core.ui.api`, `core.ui.design`, `core.ui.widgets`.

**Architecture:** Bottom-up restructure: create new packages, migrate content, update all imports, delete old packages. Each task creates one package and is independently committable. The `core.shared` barrel stays alive as a re-export shim until all tasks are done, then gets deleted in the final task.

**Tech Stack:** Effect, `@effect/sql` Model.Class, `@effect/rpc`, TypeScript, Bun workspaces

**Spec:** `docs/superpowers/specs/2026-03-22-event-driven-architecture-v2-design.md`

---

## File Structure

### New packages to create

```
packages/libs/
  core.base.model/src/
    session.ts         → Model.Class<Session>
    bookmark.ts        → Model.Class<Bookmark>
    history-entry.ts   → Model.Class<HistoryEntry>
    page.ts            → Model.Class<Page>
    index.ts           → barrel

  core.base.types/src/
    ids.ts             → SessionId, BookmarkId, HistoryEntryId (branded)
    constants.ts       → DEFAULT_TAB_URL, DEFAULT_TAB_TITLE, DEFAULT_SESSION_MODE, APP_NAME, APP_VERSION
    session-helpers.ts → currentPage, canGoBack, canGoForward, currentUrl
    index.ts           → barrel

  core.base.tracing/src/
    with-tracing.ts    → withTracing (Effect spans)
    with-web-tracing.ts → withWebTracing (OTel API spans)
    span-name.ts       → spanName utility
    index.ts           → barrel

  core.port.event-bus/src/         (renamed from core.ports.event-bus)
    event-bus.port.ts              → EventBus Context.Tag (existing)
    event-bus.live.ts              → PubSub implementation (existing)
    event-bus.rpc.ts               → RPC contract (existing)
    event-bus.handlers.ts          → RPC handlers (existing)
    signals/
      session.ts                   → SessionSignals (typed commands + events)
      navigation.ts                → NavigationSignals
      workspace.ts                 → WorkspaceSignals
      bookmark.ts                  → BookmarkSignals
      history.ts                   → HistorySignals
      agent.ts                     → AgentSignals
      ui.ts                        → UISignals
      diagnostics.ts               → DiagnosticSignals
      index.ts                     → barrel + Op helper
    shortcuts.ts                   → ShortcutBinding + DEFAULT_SHORTCUTS
    index.ts                       → barrel

  core.ui.api/src/
    api-provider.tsx               → <ApiProvider> context
    use-api.ts                     → useApi() hook (typed EventBus client)
    index.ts                       → barrel

  core.ui.design/src/
    index.css                      → moved from core.ui/src/styles
    tokens/
      design-tokens.css            → moved
      themes/dark.css              → moved
    index.ts                       → barrel (empty, CSS-only)

  core.ui.widgets/src/
    components/                    → moved from core.ui/src/components
    lib/
      runtime-provider.tsx         → moved
      use-stream.ts                → moved
      use-service.ts               → moved
      use-domain-service.ts        → moved
    index.ts                       → barrel (same exports as current core.ui)
```

### Packages to delete (after migration)

```
packages/libs/core.shared/         → replaced by core.base.* + core.port.event-bus signals
packages/libs/core.ports.event-bus/ → renamed to core.port.event-bus (singular)
packages/libs/core.ui/             → split into core.ui.api + core.ui.design + core.ui.widgets
```

### Packages that need import updates (consumers)

Every file that imports from `@ctrl/core.shared` or `@ctrl/core.ports.event-bus` or `@ctrl/core.ui` — approximately 45 import statements across 30+ files. Each task includes the exact import rewrites for its scope.

---

## Task 1: Create `core.base.types`

**Files:**
- Create: `packages/libs/core.base.types/package.json`
- Create: `packages/libs/core.base.types/src/ids.ts`
- Create: `packages/libs/core.base.types/src/constants.ts`
- Create: `packages/libs/core.base.types/src/session-helpers.ts`
- Create: `packages/libs/core.base.types/src/index.ts`
- Create: `packages/libs/core.base.types/src/ids.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ctrl/core.base.types",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check": "tsgo --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Write branded IDs**

`packages/libs/core.base.types/src/ids.ts`:
```typescript
import { Brand } from "effect"

export type SessionId = string & Brand.Brand<"SessionId">
export const SessionId = Brand.nominal<SessionId>()

export type BookmarkId = string & Brand.Brand<"BookmarkId">
export const BookmarkId = Brand.nominal<BookmarkId>()

export type HistoryEntryId = string & Brand.Brand<"HistoryEntryId">
export const HistoryEntryId = Brand.nominal<HistoryEntryId>()

export type PageId = string & Brand.Brand<"PageId">
export const PageId = Brand.nominal<PageId>()
```

- [ ] **Step 3: Write constants**

`packages/libs/core.base.types/src/constants.ts`:
```typescript
export const APP_NAME = "ctrl.page" as const
export const APP_VERSION = "0.0.1" as const
export const DEFAULT_TAB_URL = "about:blank" as const
export const DEFAULT_TAB_TITLE = "New Tab" as const
export const DEFAULT_SESSION_MODE = "visual" as const
```

- [ ] **Step 4: Write session helpers**

`packages/libs/core.base.types/src/session-helpers.ts`:
```typescript
import { DEFAULT_TAB_URL } from "./constants"

// Minimal types — will be replaced by Model.Class imports in Task 2
export type Page = { readonly url: string; readonly title: string | null; readonly loadedAt: string }
export type SessionLike = {
  readonly pages: readonly Page[]
  readonly currentIndex: number
}

export const currentPage = (session: SessionLike): Page | undefined =>
  session.pages[session.currentIndex]

export const canGoBack = (session: SessionLike): boolean => session.currentIndex > 0

export const canGoForward = (session: SessionLike): boolean =>
  session.currentIndex < session.pages.length - 1

export const currentUrl = (session: SessionLike): string =>
  currentPage(session)?.url ?? DEFAULT_TAB_URL
```

- [ ] **Step 5: Write test for branded IDs**

`packages/libs/core.base.types/src/ids.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { SessionId, BookmarkId } from "./ids"

describe("Branded IDs", () => {
  it("creates a SessionId from string", () => {
    const id = SessionId("abc-123")
    expect(id).toBe("abc-123")
  })

  it("creates a BookmarkId from string", () => {
    const id = BookmarkId("bm-456")
    expect(id).toBe("bm-456")
  })
})
```

- [ ] **Step 6: Write barrel + run tests**

`packages/libs/core.base.types/src/index.ts`:
```typescript
export * from "./ids"
export * from "./constants"
export { currentPage, canGoBack, canGoForward, currentUrl } from "./session-helpers"
export type { Page, SessionLike } from "./session-helpers"
```

Run: `bunx vitest run packages/libs/core.base.types`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/libs/core.base.types
git commit -m "feat: create core.base.types — branded IDs, constants, session helpers"
```

---

## Task 2: Create `core.base.model` with Model.Class

**Files:**
- Create: `packages/libs/core.base.model/package.json`
- Create: `packages/libs/core.base.model/src/page.ts`
- Create: `packages/libs/core.base.model/src/session.ts`
- Create: `packages/libs/core.base.model/src/bookmark.ts`
- Create: `packages/libs/core.base.model/src/history-entry.ts`
- Create: `packages/libs/core.base.model/src/index.ts`
- Create: `packages/libs/core.base.model/src/model.test.ts`

**Docs to check:** `@effect/sql` Model.Class API — `Model.Class`, `Model.GeneratedByApp`, `Model.DateTimeInsert`, `Model.DateTimeUpdate`, `Model.BooleanFromNumber`.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ctrl/core.base.model",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check": "tsgo --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Write Page model**

`packages/libs/core.base.model/src/page.ts`:
```typescript
import { Model } from "@effect/sql"
import { Schema } from "effect"

export class Page extends Model.Class<Page>("Page")({
  url: Schema.String,
  title: Schema.NullOr(Schema.String),
  loadedAt: Schema.String,
}) {}
```

- [ ] **Step 3: Write Session model**

`packages/libs/core.base.model/src/session.ts`:
```typescript
import { Model } from "@effect/sql"
import { Schema } from "effect"
import { Page } from "./page"

export class Session extends Model.Class<Session>("Session")({
  id: Model.GeneratedByApp(Schema.String),
  pages: Schema.Array(Page),
  currentIndex: Schema.Number,
  mode: Schema.Literal("visual"),
  isActive: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}
```

Note: We use `Schema.String` for id/dates for now (matching current schema). Branded IDs from `core.base.types` can be adopted gradually. `Model.BooleanFromNumber` and `Model.DateTimeInsert/Update` will be adopted when `domain.adapter.db` migrates to `Model.makeRepository` (Phase 2).

- [ ] **Step 4: Write Bookmark model**

`packages/libs/core.base.model/src/bookmark.ts`:
```typescript
import { Model } from "@effect/sql"
import { Schema } from "effect"

export class Bookmark extends Model.Class<Bookmark>("Bookmark")({
  id: Model.GeneratedByApp(Schema.String),
  url: Schema.String,
  title: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
}) {}
```

- [ ] **Step 5: Write HistoryEntry model**

`packages/libs/core.base.model/src/history-entry.ts`:
```typescript
import { Model } from "@effect/sql"
import { Schema } from "effect"

export class HistoryEntry extends Model.Class<HistoryEntry>("HistoryEntry")({
  id: Model.GeneratedByApp(Schema.String),
  url: Schema.String,
  title: Schema.NullOr(Schema.String),
  query: Schema.NullOr(Schema.String),
  visitedAt: Schema.String,
}) {}
```

- [ ] **Step 6: Write barrel**

`packages/libs/core.base.model/src/index.ts`:
```typescript
export { Page } from "./page"
export { Session } from "./session"
export { Bookmark } from "./bookmark"
export { HistoryEntry } from "./history-entry"
```

- [ ] **Step 7: Write model tests**

`packages/libs/core.base.model/src/model.test.ts`:
```typescript
import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import { Bookmark, HistoryEntry, Page, Session } from "./index"

describe("Model.Class definitions", () => {
  it("Session decodes from plain object", () => {
    const raw = {
      id: "s1",
      pages: [{ url: "https://example.com", title: "Example", loadedAt: "2026-01-01" }],
      currentIndex: 0,
      mode: "visual" as const,
      isActive: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    }
    const result = Schema.decodeUnknownSync(Session)(raw)
    expect(result.id).toBe("s1")
    expect(result.pages).toHaveLength(1)
  })

  it("Bookmark decodes from plain object", () => {
    const raw = { id: "b1", url: "https://example.com", title: "Example", createdAt: "2026-01-01" }
    const result = Schema.decodeUnknownSync(Bookmark)(raw)
    expect(result.id).toBe("b1")
  })

  it("HistoryEntry decodes from plain object", () => {
    const raw = { id: "h1", url: "https://example.com", title: null, query: "test", visitedAt: "2026-01-01" }
    const result = Schema.decodeUnknownSync(HistoryEntry)(raw)
    expect(result.id).toBe("h1")
    expect(result.query).toBe("test")
  })

  it("Page decodes from plain object", () => {
    const raw = { url: "https://example.com", title: "Example", loadedAt: "2026-01-01" }
    const result = Schema.decodeUnknownSync(Page)(raw)
    expect(result.url).toBe("https://example.com")
  })
})
```

- [ ] **Step 8: Run tests**

Run: `bunx vitest run packages/libs/core.base.model`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/libs/core.base.model
git commit -m "feat: create core.base.model — Model.Class definitions for Session, Bookmark, HistoryEntry, Page"
```

---

## Task 3: Create `core.base.tracing`

**Files:**
- Create: `packages/libs/core.base.tracing/package.json`
- Create: `packages/libs/core.base.tracing/src/with-tracing.ts`
- Create: `packages/libs/core.base.tracing/src/with-web-tracing.ts`
- Create: `packages/libs/core.base.tracing/src/span-name.ts`
- Create: `packages/libs/core.base.tracing/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ctrl/core.base.tracing",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check": "tsgo --noEmit"
  }
}
```

- [ ] **Step 2: Copy tracing files from core.shared**

Copy these files verbatim (they have no imports from `@ctrl/core.shared`):
- `packages/libs/core.shared/src/lib/span-name.ts` → `packages/libs/core.base.tracing/src/span-name.ts`
- `packages/libs/core.shared/src/lib/with-tracing.ts` → `packages/libs/core.base.tracing/src/with-tracing.ts`
  - Update import: `"./span-name"` → `"./span-name"` (same, no change needed)
- `packages/libs/core.shared/src/lib/with-web-tracing.ts` → `packages/libs/core.base.tracing/src/with-web-tracing.ts`
  - Update import: `"./span-name"` → `"./span-name"` (same, no change needed)

- [ ] **Step 3: Write barrel**

`packages/libs/core.base.tracing/src/index.ts`:
```typescript
export { spanName } from "./span-name"
export { withTracing } from "./with-tracing"
export { withWebTracing } from "./with-web-tracing"
```

- [ ] **Step 4: Run type check**

Run: `cd packages/libs/core.base.tracing && bunx tsgo --noEmit`
Expected: PASS (no errors)

- [ ] **Step 5: Commit**

```bash
git add packages/libs/core.base.tracing
git commit -m "feat: create core.base.tracing — withTracing, withWebTracing, spanName"
```

---

## Task 4: Create `core.base.errors`

**Files:**
- Create: `packages/libs/core.base.errors/package.json`
- Create: `packages/libs/core.base.errors/src/errors.ts`
- Create: `packages/libs/core.base.errors/src/index.ts`

- [ ] **Step 1: Create package**

`packages/libs/core.base.errors/package.json`:
```json
{
  "name": "@ctrl/core.base.errors",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check": "tsgo --noEmit"
  }
}
```

`packages/libs/core.base.errors/src/errors.ts` — copy from `core.shared/src/model/errors.ts` verbatim:
```typescript
import { Schema } from "effect"

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  message: Schema.String,
  field: Schema.optional(Schema.String),
}) {}
```

`packages/libs/core.base.errors/src/index.ts`:
```typescript
export { DatabaseError, ValidationError } from "./errors"
```

- [ ] **Step 2: Commit**

```bash
git add packages/libs/core.base.errors
git commit -m "feat: create core.base.errors — DatabaseError, ValidationError"
```

---

## Task 5: Rename `core.ports.event-bus` → `core.port.event-bus` + add typed signals

This is the most complex task. We rename the package, add typed signal definitions, and update all consumers.

**Files:**
- Rename: `packages/libs/core.ports.event-bus/` → `packages/libs/core.port.event-bus/`
- Create: `packages/libs/core.port.event-bus/src/signals/op.ts`
- Create: `packages/libs/core.port.event-bus/src/signals/session.ts`
- Create: `packages/libs/core.port.event-bus/src/signals/navigation.ts`
- Create: `packages/libs/core.port.event-bus/src/signals/workspace.ts`
- Create: `packages/libs/core.port.event-bus/src/signals/bookmark.ts`
- Create: `packages/libs/core.port.event-bus/src/signals/history.ts`
- Create: `packages/libs/core.port.event-bus/src/signals/agent.ts`
- Create: `packages/libs/core.port.event-bus/src/signals/ui.ts`
- Create: `packages/libs/core.port.event-bus/src/signals/diagnostics.ts`
- Create: `packages/libs/core.port.event-bus/src/signals/index.ts`
- Create: `packages/libs/core.port.event-bus/src/shortcuts.ts`
- Modify: `packages/libs/core.port.event-bus/src/index.ts`
- Modify: `packages/libs/core.port.event-bus/package.json`
- Modify: all consumers importing `@ctrl/core.ports.event-bus`

- [ ] **Step 1: Rename the directory**

```bash
mv packages/libs/core.ports.event-bus packages/libs/core.port.event-bus
```

- [ ] **Step 2: Update package.json name**

In `packages/libs/core.port.event-bus/package.json`, change `"name"` to `"@ctrl/core.port.event-bus"`.

- [ ] **Step 3: Create the `Op` signal builder**

`packages/libs/core.port.event-bus/src/signals/op.ts`:
```typescript
import type { Schema } from "effect"

/** Typed command definition */
export type CommandDef<N extends string = string, P = void> = {
  readonly _tag: "command"
  readonly name: N
  readonly schema: Schema.Schema<P>
}

/** Typed event definition */
export type EventDef<N extends string = string, P = void> = {
  readonly _tag: "event"
  readonly name: N
  readonly schema: Schema.Schema<P>
}

/** Create a typed command definition */
export const command = <N extends string, P>(
  name: N,
  schema: Schema.Schema<P>,
): CommandDef<N, P> => ({
  _tag: "command",
  name,
  schema,
})

/** Create a typed event definition */
export const event = <N extends string, P>(
  name: N,
  schema: Schema.Schema<P>,
): EventDef<N, P> => ({
  _tag: "event",
  name,
  schema,
})
```

- [ ] **Step 4: Create session signals**

`packages/libs/core.port.event-bus/src/signals/session.ts`:
```typescript
import { Schema } from "effect"
import * as Op from "./op"

export const SessionSignals = {
  commands: {
    create: Op.command("session.create", Schema.Struct({ mode: Schema.Literal("visual") })),
    close: Op.command("session.close", Schema.Struct({ id: Schema.String })),
    activate: Op.command("session.activate", Schema.Struct({ id: Schema.String })),
  },
  events: {
    created: Op.event("session.created", Schema.Struct({ id: Schema.String, mode: Schema.Literal("visual") })),
    closed: Op.event("session.closed", Schema.Struct({ id: Schema.String })),
    activated: Op.event("session.activated", Schema.Struct({ id: Schema.String })),
  },
} as const
```

- [ ] **Step 5: Create navigation signals**

`packages/libs/core.port.event-bus/src/signals/navigation.ts`:
```typescript
import { Schema } from "effect"
import * as Op from "./op"

export const NavigationSignals = {
  commands: {
    navigate: Op.command("nav.navigate", Schema.Struct({ id: Schema.String, input: Schema.String })),
    back: Op.command("nav.back", Schema.Struct({ id: Schema.String })),
    forward: Op.command("nav.forward", Schema.Struct({ id: Schema.String })),
    report: Op.command("nav.report", Schema.Struct({ id: Schema.String, url: Schema.String })),
    updateTitle: Op.command("nav.update-title", Schema.Struct({ id: Schema.String, title: Schema.String })),
  },
  events: {
    navigated: Op.event("nav.navigated", Schema.Struct({ id: Schema.String, url: Schema.String })),
    titleUpdated: Op.event("nav.title-updated", Schema.Struct({ id: Schema.String, title: Schema.String })),
  },
} as const
```

- [ ] **Step 6: Create workspace signals**

`packages/libs/core.port.event-bus/src/signals/workspace.ts`:
```typescript
import { Schema } from "effect"
import * as Op from "./op"

export const WorkspaceSignals = {
  commands: {
    splitRight: Op.command("ws.split-right", Schema.Struct({ sessionId: Schema.optional(Schema.String) })),
    splitDown: Op.command("ws.split-down", Schema.Struct({ sessionId: Schema.optional(Schema.String) })),
    closePane: Op.command("ws.close-pane", Schema.Struct({ paneId: Schema.optional(Schema.String) })),
    focusPane: Op.command("ws.focus-pane", Schema.Struct({ paneId: Schema.String })),
  },
  events: {
    layoutChanged: Op.event("ws.layout-changed", Schema.Unknown),
    paneSplit: Op.event("ws.pane-split", Schema.Struct({ direction: Schema.Literal("right", "down") })),
  },
} as const
```

- [ ] **Step 7: Create bookmark, history, agent, UI, diagnostics signals**

`packages/libs/core.port.event-bus/src/signals/bookmark.ts`:
```typescript
import { Schema } from "effect"
import * as Op from "./op"

export const BookmarkSignals = {
  commands: {
    add: Op.command("bm.add", Schema.Struct({ url: Schema.String, title: Schema.NullOr(Schema.String) })),
    remove: Op.command("bm.remove", Schema.Struct({ id: Schema.String })),
  },
  events: {
    added: Op.event("bm.added", Schema.Struct({ id: Schema.String, url: Schema.String })),
    removed: Op.event("bm.removed", Schema.Struct({ id: Schema.String })),
  },
} as const
```

`packages/libs/core.port.event-bus/src/signals/history.ts`:
```typescript
import { Schema } from "effect"
import * as Op from "./op"

export const HistorySignals = {
  commands: {
    clear: Op.command("hist.clear", Schema.Void),
  },
  events: {
    cleared: Op.event("hist.cleared", Schema.Void),
  },
} as const
```

`packages/libs/core.port.event-bus/src/signals/agent.ts`:
```typescript
import { Schema } from "effect"
import * as Op from "./op"

export const AgentSignals = {
  commands: {
    createHeadless: Op.command("agent.create-headless", Schema.Struct({ url: Schema.String })),
    evaluateJs: Op.command("agent.evaluate-js", Schema.Struct({ script: Schema.String })),
    closeHeadless: Op.command("agent.close-headless", Schema.Void),
  },
} as const
```

`packages/libs/core.port.event-bus/src/signals/ui.ts`:
```typescript
import { Schema } from "effect"
import * as Op from "./op"

export const UISignals = {
  commands: {
    toggleOmnibox: Op.command("ui.toggle-omnibox", Schema.Void),
    toggleSidebar: Op.command("ui.toggle-sidebar", Schema.Void),
  },
} as const
```

`packages/libs/core.port.event-bus/src/signals/diagnostics.ts`:
```typescript
import { Schema } from "effect"
import * as Op from "./op"

export const DiagnosticSignals = {
  commands: {
    ping: Op.command("diag.ping", Schema.Void),
  },
  events: {
    pong: Op.event("diag.pong", Schema.Struct({ timestamp: Schema.Number })),
  },
} as const
```

- [ ] **Step 8: Create signals barrel**

`packages/libs/core.port.event-bus/src/signals/index.ts`:
```typescript
export type { CommandDef, EventDef } from "./op"
export * as Op from "./op"

export { SessionSignals } from "./session"
export { NavigationSignals } from "./navigation"
export { WorkspaceSignals } from "./workspace"
export { BookmarkSignals } from "./bookmark"
export { HistorySignals } from "./history"
export { AgentSignals } from "./agent"
export { UISignals } from "./ui"
export { DiagnosticSignals } from "./diagnostics"
```

- [ ] **Step 9: Move shortcuts into core.port.event-bus**

`packages/libs/core.port.event-bus/src/shortcuts.ts`:
```typescript
import { SessionSignals } from "./signals/session"
import { NavigationSignals } from "./signals/navigation"
import { WorkspaceSignals } from "./signals/workspace"
import { UISignals } from "./signals/ui"

export type ShortcutBinding = {
  readonly action: string
  readonly shortcut: string
  readonly label: string
  readonly when?: string
}

export const DEFAULT_SHORTCUTS: readonly ShortcutBinding[] = [
  { action: SessionSignals.commands.create.name, shortcut: "Cmd+T", label: "New Tab" },
  { action: SessionSignals.commands.close.name, shortcut: "Cmd+W", label: "Close Tab" },
  { action: NavigationSignals.commands.back.name, shortcut: "Cmd+[", label: "Back" },
  { action: NavigationSignals.commands.forward.name, shortcut: "Cmd+]", label: "Forward" },
  { action: WorkspaceSignals.commands.splitRight.name, shortcut: "Cmd+D", label: "Split Right" },
  { action: WorkspaceSignals.commands.splitDown.name, shortcut: "Cmd+Shift+D", label: "Split Down" },
  { action: UISignals.commands.toggleOmnibox.name, shortcut: "Cmd+K", label: "Command Palette" },
  ...Array.from({ length: 9 }, (_, i) => ({
    action: SessionSignals.commands.activate.name,
    shortcut: `Cmd+${i + 1}`,
    label: `Switch to Tab ${i + 1}`,
  })),
]
```

- [ ] **Step 10: Update barrel to export signals + shortcuts**

Update `packages/libs/core.port.event-bus/src/index.ts`:
```typescript
export { EventBusHandlersLive } from "./event-bus.handlers"
export { EventBusLive } from "./event-bus.live"
export {
  type AppCommand,
  type AppEvent,
  type CommandSource,
  EVENT_BUS_ID,
  EventBus,
} from "./event-bus.port"
export { EventBusRpcs } from "./event-bus.rpc"
export * from "./signals"
export { DEFAULT_SHORTCUTS, type ShortcutBinding } from "./shortcuts"
```

- [ ] **Step 11: Write signal tests**

`packages/libs/core.port.event-bus/src/signals/signals.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { SessionSignals, NavigationSignals, BookmarkSignals, DiagnosticSignals } from "./index"

describe("Signal definitions", () => {
  it("SessionSignals.commands.create has correct name", () => {
    expect(SessionSignals.commands.create.name).toBe("session.create")
    expect(SessionSignals.commands.create._tag).toBe("command")
  })

  it("SessionSignals.events.created has correct name", () => {
    expect(SessionSignals.events.created.name).toBe("session.created")
    expect(SessionSignals.events.created._tag).toBe("event")
  })

  it("NavigationSignals.commands.navigate has correct name", () => {
    expect(NavigationSignals.commands.navigate.name).toBe("nav.navigate")
  })

  it("BookmarkSignals has commands and events", () => {
    expect(BookmarkSignals.commands.add.name).toBe("bm.add")
    expect(BookmarkSignals.events.added.name).toBe("bm.added")
  })

  it("DiagnosticSignals.commands.ping", () => {
    expect(DiagnosticSignals.commands.ping.name).toBe("diag.ping")
    expect(DiagnosticSignals.events.pong.name).toBe("diag.pong")
  })
})
```

- [ ] **Step 12: Run tests**

Run: `bunx vitest run packages/libs/core.port.event-bus`
Expected: all existing tests + new signal tests PASS

- [ ] **Step 13: Update all consumers of `@ctrl/core.ports.event-bus`**

Find and replace `@ctrl/core.ports.event-bus` → `@ctrl/core.port.event-bus` in:
- `packages/libs/core.ui/src/lib/use-event-bus.ts`
- `packages/libs/core.ui/package.json` (dependency)
- `packages/apps/desktop/src/bun/layers.ts`
- `packages/apps/desktop/src/bun/command-router.ts` (if it imports from here)

Run: `grep -r "core.ports.event-bus" packages/ --include="*.ts" --include="*.tsx" --include="*.json" -l` to find all files.

- [ ] **Step 14: Run full type check**

Run: `bun run check`
Expected: PASS

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: rename core.ports.event-bus → core.port.event-bus + add typed signal definitions"
```

---

## Task 6: Update `core.shared` to re-export from new packages (shim)

Before deleting `core.shared`, make it a thin re-export shim so all consumers keep working while we update imports file by file.

**Files:**
- Modify: `packages/libs/core.shared/package.json` (add deps)
- Modify: `packages/libs/core.shared/src/index.ts`

- [ ] **Step 1: Add dependencies to core.shared**

In `packages/libs/core.shared/package.json`, add:
```json
"dependencies": {
  "@ctrl/core.base.model": "workspace:*",
  "@ctrl/core.base.types": "workspace:*",
  "@ctrl/core.base.tracing": "workspace:*",
  "@ctrl/core.base.errors": "workspace:*",
  "@ctrl/core.port.event-bus": "workspace:*"
}
```

- [ ] **Step 2: Rewrite core.shared index as re-export shim**

`packages/libs/core.shared/src/index.ts`:
```typescript
// Re-export shim — consumers should migrate to direct imports from core.base.*
// This file will be deleted once all consumers are updated.

// core.base.types
export {
  APP_NAME,
  APP_VERSION,
  DEFAULT_SESSION_MODE,
  DEFAULT_TAB_TITLE,
  DEFAULT_TAB_URL,
  canGoBack,
  canGoForward,
  currentPage,
  currentUrl,
} from "@ctrl/core.base.types"
export type { SessionLike } from "@ctrl/core.base.types"

// core.base.model (re-export as schemas for backwards compat)
export { Bookmark, HistoryEntry, Page, Session } from "@ctrl/core.base.model"
// Aliases for old schema names
export {
  Page as PageSchema,
  Session as SessionSchema,
  Bookmark as BookmarkSchema,
  HistoryEntry as HistoryEntrySchema,
} from "@ctrl/core.base.model"
// BrowsingState is a compound type, keep it here for now
import { Schema } from "effect"
import { Bookmark, HistoryEntry, Session } from "@ctrl/core.base.model"
export const BrowsingStateSchema = Schema.Struct({
  sessions: Schema.Array(Session),
  bookmarks: Schema.Array(Bookmark),
  history: Schema.Array(HistoryEntry),
})
export type BrowsingState = typeof BrowsingStateSchema.Type

// core.base.tracing
export { spanName, withTracing, withWebTracing } from "@ctrl/core.base.tracing"

// core.base.errors
export { DatabaseError, ValidationError } from "@ctrl/core.base.errors"

// core.port.event-bus (shortcuts + action constants for compat)
export { DEFAULT_SHORTCUTS } from "@ctrl/core.port.event-bus"
export type { ShortcutBinding } from "@ctrl/core.port.event-bus"

// Legacy: action string constants (consumers should migrate to Signal definitions)
export {
  SessionSignals,
  NavigationSignals,
  WorkspaceSignals,
  BookmarkSignals,
  HistorySignals,
  AgentSignals,
  UISignals,
  DiagnosticSignals,
} from "@ctrl/core.port.event-bus"

// Keep old string constants as aliases (will be removed when consumers migrate)
export const SESSION_CREATE = "session.create" as const
export const SESSION_CLOSE = "session.close" as const
export const SESSION_ACTIVATE = "session.activate" as const
export const NAV_NAVIGATE = "nav.navigate" as const
export const NAV_BACK = "nav.back" as const
export const NAV_FORWARD = "nav.forward" as const
export const NAV_REPORT = "nav.report" as const
export const NAV_UPDATE_TITLE = "nav.update-title" as const
export const WS_SPLIT_RIGHT = "ws.split-right" as const
export const WS_SPLIT_DOWN = "ws.split-down" as const
export const WS_CLOSE_PANE = "ws.close-pane" as const
export const WS_FOCUS_PANE = "ws.focus-pane" as const
export const BM_ADD = "bm.add" as const
export const BM_REMOVE = "bm.remove" as const
export const HIST_CLEAR = "hist.clear" as const
export const AGENT_CREATE_HEADLESS = "agent.create-headless" as const
export const AGENT_EVALUATE_JS = "agent.evaluate-js" as const
export const AGENT_CLOSE_HEADLESS = "agent.close-headless" as const
export const UI_TOGGLE_OMNIBOX = "ui.toggle-omnibox" as const
export const UI_TOGGLE_SIDEBAR = "ui.toggle-sidebar" as const
export const EVT_SESSION_CREATED = "session.created" as const
export const EVT_SESSION_CLOSED = "session.closed" as const
export const EVT_SESSION_ACTIVATED = "session.activated" as const
export const EVT_NAVIGATED = "nav.navigated" as const
export const EVT_TITLE_UPDATED = "nav.title-updated" as const
export const EVT_LAYOUT_CHANGED = "ws.layout-changed" as const
export const EVT_PANE_SPLIT = "ws.pane-split" as const
export const EVT_BOOKMARK_ADDED = "bm.added" as const
export const EVT_BOOKMARK_REMOVED = "bm.removed" as const
export const EVT_HISTORY_CLEARED = "hist.cleared" as const
export const EVT_SYS_DOM_READY = "sys.dom-ready" as const
export const EVT_SYS_DID_NAVIGATE = "sys.did-navigate" as const
export const DIAG_PING = "diag.ping" as const
export const EVT_DIAG_PONG = "diag.pong" as const

// Legacy: port tags (will move to core.port.storage in Phase 2)
export { makeFeatureService } from "./api/make-feature-service"
export type { AppCommand, ShowNotification, ToggleCommandCenter } from "./model/commands"
export * from "./model/ports"
export * from "./rpc-schemas"
```

- [ ] **Step 3: Run full type check + tests**

Run: `bun run check && bun run test`
Expected: PASS — all consumers still work through the shim

- [ ] **Step 4: Commit**

```bash
git add packages/libs/core.shared
git commit -m "refactor: core.shared → re-export shim over core.base.* packages"
```

---

## Task 7: Migrate consumer imports — domain packages

Update all `domain.*` packages to import from `core.base.*` instead of `core.shared`.

**Files to modify (all `@ctrl/core.shared` imports):**
- `packages/libs/domain.adapter.db/src/api/*.ts` + tests
- `packages/libs/domain.adapter.db/src/lib/make-repository.ts`
- `packages/libs/domain.adapter.electrobun/src/api/ipc-bridge.ts` + test
- `packages/libs/domain.feature.session/src/**/*.ts`
- `packages/libs/domain.feature.bookmark/src/**/*.ts`
- `packages/libs/domain.feature.history/src/**/*.ts`
- `packages/libs/domain.feature.layout/src/**/*.ts`
- `packages/libs/domain.feature.omnibox/src/**/*.ts`
- `packages/libs/domain.feature.panel/src/**/*.ts` (if any)
- `packages/libs/domain.service.browsing/src/**/*.ts`
- `packages/libs/domain.service.workspace/src/**/*.ts`

- [ ] **Step 1: Update domain.adapter.db imports**

Replace imports in each file:
- `DatabaseError` → from `@ctrl/core.base.errors`
- `withTracing` → from `@ctrl/core.base.tracing`
- `SessionRepository`, `BookmarkRepository`, `HistoryRepository`, `LayoutRepository` → from `@ctrl/core.shared` (stays until core.port.storage exists in Phase 2)
- `DEFAULT_TAB_URL` → from `@ctrl/core.base.types`
- Type imports (`Bookmark`, `Session`, etc.) → from `@ctrl/core.base.model`

- [ ] **Step 2: Update domain.feature.* imports**

Same pattern: split imports by target package. Repository Context.Tags stay on `@ctrl/core.shared` for now (Phase 2 will create `core.port.storage`).

- [ ] **Step 3: Update domain.service.* imports**

- `withTracing` → from `@ctrl/core.base.tracing`
- `DatabaseError` → from `@ctrl/core.base.errors`
- Schema types → from `@ctrl/core.base.model`
- Action constants (if used) → from `@ctrl/core.port.event-bus`

- [ ] **Step 4: Update domain.adapter.electrobun imports**

- `AppCommand` type → from `@ctrl/core.port.event-bus` (the EventBus port already exports this)

- [ ] **Step 5: Run full type check + tests**

Run: `bun run check && bun run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.*
git commit -m "refactor: domain packages — import from core.base.* instead of core.shared"
```

---

## Task 8: Migrate consumer imports — UI + apps packages

**Files to modify:**
- `packages/libs/ui.feature.sidebar/src/**/*.ts`
- `packages/libs/ui.scenes/src/**/*.ts`
- `packages/libs/core.ui/src/components/templates/AppShellTemplate/ui/AppShellTemplate.tsx`
- `packages/apps/desktop/src/bun/*.ts`
- `packages/apps/desktop/src/main-ui/mount.tsx`
- `packages/apps/desktop/src/test/*.ts`

- [ ] **Step 1: Update ui.feature.sidebar imports**

- `currentUrl`, `Session` → from `@ctrl/core.base.model` / `@ctrl/core.base.types`
- `withWebTracing` → from `@ctrl/core.base.tracing`
- `BrowsingState` → keep from `@ctrl/core.shared` (compound type, moves later)

- [ ] **Step 2: Update ui.scenes imports**

- `currentUrl` → from `@ctrl/core.base.types`

- [ ] **Step 3: Update core.ui component imports**

- `DEFAULT_SHORTCUTS` → from `@ctrl/core.port.event-bus`
- Update `core.ui/package.json` dependency: replace `@ctrl/core.shared` with `@ctrl/core.port.event-bus`

- [ ] **Step 4: Update desktop app imports**

- `packages/apps/desktop/src/bun/index.ts`: `APP_NAME, APP_VERSION` → from `@ctrl/core.base.types`
- `packages/apps/desktop/src/bun/shortcuts.ts`: `DEFAULT_SHORTCUTS` → from `@ctrl/core.port.event-bus`
- `packages/apps/desktop/src/bun/command-router.ts`: action constants → from `@ctrl/core.port.event-bus` signals
- `packages/apps/desktop/src/bun/rpc.ts`: rpc schemas → from `@ctrl/core.shared` (stays, RPC stuff moves Phase 2)
- `packages/apps/desktop/src/bun/view-manager.ts`: `DEFAULT_TAB_URL` → from `@ctrl/core.base.types`
- `packages/apps/desktop/src/main-ui/mount.tsx`: `AppCommand` → from `@ctrl/core.port.event-bus`
- `packages/apps/desktop/src/test/*.ts`: split imports

- [ ] **Step 5: Run full type check + tests**

Run: `bun run check && bun run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/ui.* packages/libs/core.ui packages/apps/desktop
git commit -m "refactor: UI + apps — import from core.base.* and core.port.event-bus"
```

---

## Task 9: Split `core.ui` → `core.ui.widgets` + `core.ui.design` + `core.ui.api`

**Files:**
- Create: `packages/libs/core.ui.widgets/` (move components, lib)
- Create: `packages/libs/core.ui.design/` (move tokens, styles)
- Create: `packages/libs/core.ui.api/` (new: ApiProvider + useApi)
- Modify: all consumers of `@ctrl/core.ui`

- [ ] **Step 1: Create core.ui.design**

```json
{
  "name": "@ctrl/core.ui.design",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./build/styles.css"
  }
}
```

Move:
- `core.ui/src/styles/` → `core.ui.design/src/styles/`
- `core.ui/src/tokens/` → `core.ui.design/src/tokens/`
- Build scripts for CSS (panda codegen, cssgen) move to this package

`core.ui.design/src/index.ts`:
```typescript
// CSS-only package. Import styles via "@ctrl/core.ui.design/styles.css"
```

- [ ] **Step 2: Create core.ui.widgets**

Move all components + lib (except use-event-bus.ts) from `core.ui`:

```json
{
  "name": "@ctrl/core.ui.widgets",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@ctrl/core.port.event-bus": "workspace:*",
    "@ctrl/core.ui.design": "workspace:*"
  }
}
```

Move:
- `core.ui/src/components/` → `core.ui.widgets/src/components/`
- `core.ui/src/lib/runtime-provider.tsx` → `core.ui.widgets/src/lib/`
- `core.ui/src/lib/use-stream.ts` → `core.ui.widgets/src/lib/`
- `core.ui/src/lib/use-service.ts` → `core.ui.widgets/src/lib/`
- `core.ui/src/lib/use-domain-service.ts` → `core.ui.widgets/src/lib/`

Barrel: same exports as current `core.ui/src/index.ts` minus `useEventBus`.

- [ ] **Step 3: Create core.ui.api**

```json
{
  "name": "@ctrl/core.ui.api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@ctrl/core.port.event-bus": "workspace:*"
  }
}
```

Move `core.ui/src/lib/use-event-bus.ts` → `core.ui.api/src/use-event-bus.ts`

For now, this package is thin — it grows in Phase 3 when `useApi()` + `<ApiProvider>` are built.

`core.ui.api/src/index.ts`:
```typescript
export { useEventBus } from "./use-event-bus"
```

- [ ] **Step 4: Make core.ui a re-export shim**

Update `core.ui` to re-export from the three new packages:
```typescript
export * from "@ctrl/core.ui.widgets"
export { useEventBus } from "@ctrl/core.ui.api"
```

- [ ] **Step 5: Run full type check + tests**

Run: `bun run check && bun run test`
Expected: PASS (consumers still import from `@ctrl/core.ui`)

- [ ] **Step 6: Update consumer imports to use new packages directly**

Update all files that import from `@ctrl/core.ui`:
- Components → from `@ctrl/core.ui.widgets`
- `useEventBus` → from `@ctrl/core.ui.api`
- CSS → from `@ctrl/core.ui.design/styles.css`

- [ ] **Step 7: Run full type check + tests**

Run: `bun run check && bun run test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: split core.ui → core.ui.widgets + core.ui.design + core.ui.api"
```

---

## Task 10: Delete `core.shared` shim + old `core.ui`

Final cleanup — remove the shim packages.

**Files:**
- Delete: `packages/libs/core.shared/`
- Delete: old `core.ui/` (if fully replaced by core.ui.*)
- Delete: old `core.ports.event-bus/` (already renamed, should be gone)

- [ ] **Step 1: Verify no remaining imports**

Run:
```bash
grep -r "@ctrl/core.shared" packages/ --include="*.ts" --include="*.tsx" -l
```
Expected: only `core.shared/src/` files (self-references). If other files found, update them first.

- [ ] **Step 2: Verify old core.ui is not imported**

Run:
```bash
grep -r "from \"@ctrl/core.ui\"" packages/ --include="*.ts" --include="*.tsx" -l
```
Expected: only `core.ui/src/` files (self-references).

- [ ] **Step 3: Delete packages**

```bash
rm -rf packages/libs/core.shared
```

If `core.ui` is fully replaced:
```bash
rm -rf packages/libs/core.ui
```

- [ ] **Step 4: Run full type check + tests**

Run: `bun run check && bun run test`
Expected: PASS

- [ ] **Step 5: Run lint (grit + biome)**

Run: `bun run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete core.shared and core.ui shims — migration to core.base.* complete"
```

---

## Summary

| Task | Package | Depends on |
|------|---------|-----------|
| 1 | `core.base.types` | — |
| 2 | `core.base.model` | — |
| 3 | `core.base.tracing` | — |
| 4 | `core.base.errors` | — |
| 5 | `core.port.event-bus` (rename + signals) | Tasks 1-4 (for signal schemas) |
| 6 | `core.shared` → re-export shim | Tasks 1-5 |
| 7 | Domain import migration | Task 6 |
| 8 | UI + apps import migration | Task 6 |
| 9 | Split `core.ui` → 3 packages | Task 8 |
| 10 | Delete shims | Tasks 7-9 |

Tasks 1-4 can be parallelized. Tasks 7-8 can be parallelized. Total: ~10 tasks, ~50 steps.
