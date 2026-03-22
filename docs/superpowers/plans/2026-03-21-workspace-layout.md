# Workspace Layout System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to split their browser window into multiple tiled panes with Zen Browser-style sidebar tab grouping, powered by dockview-core.

**Architecture:** Domain layer defines layout tree schemas and workspace RPC service. A thin SolidJS adapter wraps dockview-core. UI feature layer connects domain state to dockview and refactors the sidebar for tab grouping. Sessions stay flat — layout is a separate descriptor referencing session IDs.

**Tech Stack:** Effect (Schema, RPC, Layer, Stream), dockview-core v5, SolidJS, Panda CSS (sva), Drizzle ORM (SQLite), vitest

**Spec:** `docs/superpowers/specs/2026-03-21-workspace-layout-design.md`

---

## Phase 1: Domain Layer

### Task 1: Scaffold `domain.feature.layout` package

**Files:**
- Create: `packages/libs/domain.feature.layout/package.json`
- Create: `packages/libs/domain.feature.layout/tsconfig.json`
- Create: `packages/libs/domain.feature.layout/src/index.ts`
- Create: `packages/libs/domain.feature.layout/src/lib/constants.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ctrl/domain.feature.layout",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check": "tsgo --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@ctrl/core.shared": "workspace:*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../../tsconfig.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Create constants**

```typescript
// src/lib/constants.ts
export const LAYOUT_FEATURE = "LayoutFeature" as const;
```

- [ ] **Step 4: Create barrel export**

```typescript
// src/index.ts
export { LAYOUT_FEATURE } from "./lib/constants";
```

- [ ] **Step 5: Verify typecheck**

Run: `cd packages/libs/domain.feature.layout && bunx tsgo --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.feature.layout
git commit -m "feat: scaffold domain.feature.layout package"
```

---

### Task 2: Define layout tree Effect Schemas

**Files:**
- Create: `packages/libs/domain.feature.layout/src/model/layout.validators.ts`
- Create: `packages/libs/domain.feature.layout/src/model/layout.schemas.test.ts`
- Modify: `packages/libs/domain.feature.layout/src/index.ts`

- [ ] **Step 1: Write schema validation tests**

```typescript
// src/model/layout.schemas.test.ts
import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  PanelRefSchema,
  GroupNodeSchema,
  SplitNodeSchema,
  LayoutNodeSchema,
} from "./layout.schemas";

describe("Layout Schemas", () => {
  it("validates a session PanelRef", () => {
    const result = Schema.decodeUnknownSync(PanelRefSchema)({
      id: "panel-1",
      type: "session",
      sessionId: "session-abc",
    });
    expect(result.id).toBe("panel-1");
    expect(result.type).toBe("session");
    expect(result.sessionId).toBe("session-abc");
  });

  it("validates a tool PanelRef", () => {
    const result = Schema.decodeUnknownSync(PanelRefSchema)({
      id: "panel-2",
      type: "tool",
      toolId: "bookmarks",
    });
    expect(result.type).toBe("tool");
    expect(result.toolId).toBe("bookmarks");
  });

  it("validates a GroupNode", () => {
    const result = Schema.decodeUnknownSync(GroupNodeSchema)({
      type: "group",
      panels: [{ id: "p1", type: "session", sessionId: "s1" }],
      activePanel: "p1",
    });
    expect(result.type).toBe("group");
    expect(result.panels).toHaveLength(1);
  });

  it("validates a SplitNode", () => {
    const result = Schema.decodeUnknownSync(SplitNodeSchema)({
      type: "split",
      direction: "horizontal",
      children: [
        { type: "group", panels: [{ id: "p1", type: "session", sessionId: "s1" }], activePanel: "p1" },
        { type: "group", panels: [{ id: "p2", type: "session", sessionId: "s2" }], activePanel: "p2" },
      ],
      sizes: [0.5, 0.5],
    });
    expect(result.direction).toBe("horizontal");
    expect(result.children).toHaveLength(2);
    expect(result.sizes).toEqual([0.5, 0.5]);
  });

  it("validates nested layout tree", () => {
    const tree = {
      type: "split",
      direction: "horizontal",
      children: [
        { type: "group", panels: [{ id: "p1", type: "session", sessionId: "s1" }], activePanel: "p1" },
        {
          type: "split",
          direction: "vertical",
          children: [
            { type: "group", panels: [{ id: "p2", type: "tool", toolId: "bookmarks" }], activePanel: "p2" },
            { type: "group", panels: [{ id: "p3", type: "session", sessionId: "s3" }], activePanel: "p3" },
          ],
          sizes: [0.4, 0.6],
        },
      ],
      sizes: [0.5, 0.5],
    };
    const result = Schema.decodeUnknownSync(LayoutNodeSchema)(tree);
    expect(result.type).toBe("split");
  });

  it("rejects invalid direction", () => {
    expect(() =>
      Schema.decodeUnknownSync(SplitNodeSchema)({
        type: "split",
        direction: "diagonal",
        children: [],
        sizes: [],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/libs/domain.feature.layout && bun test`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement schemas**

```typescript
// src/model/layout.validators.ts
import { Schema } from "effect";

export const PanelRefSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("session", "tool"),
  sessionId: Schema.optional(Schema.String),
  toolId: Schema.optional(Schema.String),
});

export type PanelRef = typeof PanelRefSchema.Type;

export const GroupNodeSchema = Schema.Struct({
  type: Schema.Literal("group"),
  panels: Schema.Array(PanelRefSchema),
  activePanel: Schema.String,
});

export type GroupNode = typeof GroupNodeSchema.Type;

export const SplitNodeSchema: Schema.Schema<SplitNode> = Schema.suspend(() =>
  Schema.Struct({
    type: Schema.Literal("split"),
    direction: Schema.Literal("horizontal", "vertical"),
    children: Schema.Array(LayoutNodeSchema),
    sizes: Schema.Array(Schema.Number),
  }),
);

export type SplitNode = {
  readonly type: "split";
  readonly direction: "horizontal" | "vertical";
  readonly children: ReadonlyArray<LayoutNode>;
  readonly sizes: ReadonlyArray<number>;
};

export const LayoutNodeSchema: Schema.Schema<LayoutNode> = Schema.suspend(() =>
  Schema.Union(SplitNodeSchema, GroupNodeSchema),
);

export type LayoutNode = SplitNode | GroupNode;

export const PersistedLayoutSchema = Schema.Struct({
  version: Schema.Number,
  dockviewState: Schema.Unknown,
});

export type PersistedLayout = typeof PersistedLayoutSchema.Type;
```

- [ ] **Step 4: Update barrel export**

```typescript
// src/index.ts
export { LAYOUT_FEATURE } from "./lib/constants";
export {
  PanelRefSchema,
  GroupNodeSchema,
  SplitNodeSchema,
  LayoutNodeSchema,
  PersistedLayoutSchema,
} from "./model/layout.schemas";
export type {
  PanelRef,
  GroupNode,
  SplitNode,
  LayoutNode,
  PersistedLayout,
} from "./model/layout.schemas";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/libs/domain.feature.layout && bun test`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.feature.layout
git commit -m "feat: layout tree Effect Schemas with validation tests"
```

---

### Task 3: Implement `LayoutFeature` service

**Files:**
- Create: `packages/libs/domain.feature.layout/src/api/layout.feature.ts`
- Create: `packages/libs/domain.feature.layout/src/api/layout.feature.test.ts`
- Modify: `packages/libs/domain.feature.layout/src/index.ts`
- Reference: `packages/libs/core.shared/src/api/make-feature-service.ts` for pattern

**Note:** The `LayoutFeature` manages layout state in-memory with persistence delegated to a repository. It provides operations for splitting, moving, and closing panels, plus a change stream.

- [ ] **Step 1: Define LayoutRepository tag in core.shared**

Add to `packages/libs/core.shared/src/model/ports.ts` (where `SessionRepository`, `BookmarkRepository`, `HistoryRepository` are defined):

```typescript
export class LayoutRepository extends Context.Tag("LayoutRepository")<
  LayoutRepository,
  {
    readonly getLayout: () => Effect.Effect<PersistedLayout | null, DatabaseError>;
    readonly saveLayout: (layout: PersistedLayout) => Effect.Effect<void, DatabaseError>;
  }
>() {}
```

- [ ] **Step 2: Write failing tests for LayoutFeature**

```typescript
// src/api/layout.feature.test.ts
import { describe, expect, it } from "vitest";
import { Effect, Layer, Stream, Chunk, Fiber, Duration } from "effect";
import { LayoutFeature, LayoutFeatureLive } from "./layout.feature";
import { LayoutRepository } from "@ctrl/core.shared";

const makeTestLayer = () => {
  let stored: PersistedLayout | null = null;

  const MockRepo = Layer.succeed(LayoutRepository, {
    getLayout: () => Effect.succeed(stored),
    saveLayout: (layout) =>
      Effect.sync(() => {
        stored = layout;
      }),
  });

  return LayoutFeatureLive.pipe(Layer.provide(MockRepo));
};

const runTest = <A, E>(effect: Effect.Effect<A, E, LayoutFeature>) =>
  Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("LayoutFeature", () => {
  it("returns default single-pane layout when no persisted state", async () => {
    await runTest(
      Effect.gen(function* () {
        const feature = yield* LayoutFeature;
        const layout = yield* feature.getLayout();
        expect(layout.type).toBe("group");
      }),
    );
  });

  it("persists layout on update", async () => {
    await runTest(
      Effect.gen(function* () {
        const feature = yield* LayoutFeature;
        const dockviewState = { some: "state" };
        yield* feature.updateLayout({ version: 1, dockviewState });
        const layout = yield* feature.getPersistedLayout();
        expect(layout?.version).toBe(1);
      }),
    );
  });

  it("emits changes on stream after update", async () => {
    await runTest(
      Effect.gen(function* () {
        const feature = yield* LayoutFeature;
        const fiber = yield* feature.changes.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        );
        yield* Effect.sleep(Duration.millis(10));
        yield* feature.updateLayout({ version: 1, dockviewState: {} });
        const collected = yield* Fiber.join(fiber);
        expect(Chunk.toArray(collected)).toHaveLength(1);
      }),
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/libs/domain.feature.layout && bun test`
Expected: FAIL

- [ ] **Step 4: Implement LayoutFeature**

```typescript
// src/api/layout.feature.ts
import { Context, Effect, Layer, PubSub, Stream } from "effect";
import { withTracing } from "@ctrl/core.shared";
import { LAYOUT_FEATURE } from "../lib/constants";
import type { LayoutNode, PersistedLayout } from "../model/layout.schemas";
import { LayoutRepository } from "@ctrl/core.shared";

const DEFAULT_LAYOUT: LayoutNode = {
  type: "group",
  panels: [],
  activePanel: "",
};

export class LayoutFeature extends Context.Tag(LAYOUT_FEATURE)<
  LayoutFeature,
  {
    readonly getLayout: () => Effect.Effect<LayoutNode>;
    readonly getPersistedLayout: () => Effect.Effect<PersistedLayout | null>;
    readonly updateLayout: (layout: PersistedLayout) => Effect.Effect<void>;
    readonly changes: Stream.Stream<PersistedLayout>;
  }
>() {}

export const LayoutFeatureLive = Layer.effect(
  LayoutFeature,
  Effect.gen(function* () {
    const repo = yield* LayoutRepository;
    const pubsub = yield* PubSub.unbounded<PersistedLayout>();

    return withTracing(LAYOUT_FEATURE, {
      getLayout: () =>
        repo.getLayout().pipe(
          Effect.map((persisted) =>
            persisted ? (persisted.dockviewState as LayoutNode) : DEFAULT_LAYOUT,
          ),
          Effect.catchAll(() => Effect.succeed(DEFAULT_LAYOUT)),
        ),

      getPersistedLayout: () =>
        repo.getLayout().pipe(Effect.catchAll(() => Effect.succeed(null))),

      updateLayout: (layout: PersistedLayout) =>
        repo.saveLayout(layout).pipe(
          Effect.tap(() => PubSub.publish(pubsub, layout)),
          Effect.catchAll(() => Effect.void),
        ),

      changes: Stream.fromPubSub(pubsub),
    });
  }),
);
```

- [ ] **Step 5: Update barrel export**

Add to `src/index.ts`:
```typescript
export { LayoutFeature, LayoutFeatureLive } from "./api/layout.feature";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/libs/domain.feature.layout && bun test`
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add packages/libs/domain.feature.layout packages/libs/core.shared
git commit -m "feat: LayoutFeature service with persistence and change stream"
```

---

### Task 4: Scaffold `domain.feature.panel` package with panel registry

**Files:**
- Create: `packages/libs/domain.feature.panel/package.json`
- Create: `packages/libs/domain.feature.panel/tsconfig.json`
- Create: `packages/libs/domain.feature.panel/src/index.ts`
- Create: `packages/libs/domain.feature.panel/src/lib/constants.ts`
- Create: `packages/libs/domain.feature.panel/src/model/panel.schemas.ts`
- Create: `packages/libs/domain.feature.panel/src/model/panel.schemas.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ctrl/domain.feature.panel",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check": "tsgo --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@ctrl/core.shared": "workspace:*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json, constants**

```json
{
  "extends": "../../../tsconfig.json",
  "include": ["src"]
}
```

```typescript
// src/lib/constants.ts
export const PANEL_FEATURE = "PanelFeature" as const;

export const PANEL_TYPES = {
  SESSION: "session",
  BOOKMARKS: "bookmarks",
  HISTORY: "history",
} as const;
```

- [ ] **Step 3: Write schema tests**

```typescript
// src/model/panel.schemas.test.ts
import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { PanelDescriptorSchema, PANEL_TYPES } from "./panel.schemas";

describe("Panel Schemas", () => {
  it("validates a session panel descriptor", () => {
    const result = Schema.decodeUnknownSync(PanelDescriptorSchema)({
      type: "session",
      label: "Web Page",
      icon: "globe",
    });
    expect(result.type).toBe("session");
  });

  it("validates a tool panel descriptor", () => {
    const result = Schema.decodeUnknownSync(PanelDescriptorSchema)({
      type: "tool",
      toolId: "bookmarks",
      label: "Bookmarks",
      icon: "bookmark",
    });
    expect(result.toolId).toBe("bookmarks");
  });
});
```

- [ ] **Step 4: Implement schemas**

```typescript
// src/model/panel.schemas.ts
import { Schema } from "effect";

export const PanelDescriptorSchema = Schema.Struct({
  type: Schema.Literal("session", "tool"),
  toolId: Schema.optional(Schema.String),
  label: Schema.String,
  icon: Schema.String,
});

export type PanelDescriptor = typeof PanelDescriptorSchema.Type;

export const STATIC_PANEL_TYPES: ReadonlyArray<PanelDescriptor> = [
  { type: "session", label: "Web Page", icon: "globe" },
  { type: "tool", toolId: "bookmarks", label: "Bookmarks", icon: "bookmark" },
  { type: "tool", toolId: "history", label: "History", icon: "history" },
];
```

- [ ] **Step 5: Create barrel export, run tests**

```typescript
// src/index.ts
export { PANEL_FEATURE, PANEL_TYPES } from "./lib/constants";
export { PanelDescriptorSchema, STATIC_PANEL_TYPES } from "./model/panel.schemas";
export type { PanelDescriptor } from "./model/panel.schemas";
```

Run: `cd packages/libs/domain.feature.panel && bun test`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.feature.panel
git commit -m "feat: scaffold domain.feature.panel with panel registry schemas"
```

---

### Task 5: Add layout persistence to `domain.adapter.db`

**Files:**
- Create: `packages/libs/domain.adapter.db/src/model/workspace-layout.schema.ts`
- Create: `packages/libs/domain.adapter.db/src/api/layout.repository.ts`
- Create: `packages/libs/domain.adapter.db/src/api/layout.repository.test.ts`
- Modify: `packages/libs/domain.adapter.db/src/model/index.ts`
- Modify: `packages/libs/domain.adapter.db/src/index.ts`
- Modify: `packages/libs/domain.adapter.db/package.json` (add dependency)

- [ ] **Step 1: Define database table**

```typescript
// src/model/workspace-layout.schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const workspaceLayoutTable = sqliteTable("workspace_layout", {
  id: text("id").primaryKey().default("default"),
  version: integer("version").notNull().default(1),
  dockviewState: text("dockviewState").notNull().default("{}"),
  updatedAt: text("updatedAt").notNull(),
});
```

- [ ] **Step 2: Write repository tests**

Reference: `packages/libs/domain.adapter.db/src/api/session.repository.test.ts` for the in-memory libsql test pattern.

```typescript
// src/api/layout.repository.test.ts
import { describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import { LayoutRepositoryLive } from "./layout.repository";
// ... test layer setup with in-memory libsql

describe("LayoutRepository", () => {
  it("returns null when no layout saved", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* LayoutRepository;
        const layout = yield* repo.getLayout();
        expect(layout).toBeNull();
      }),
    );
  });

  it("saves and retrieves layout", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* LayoutRepository;
        yield* repo.saveLayout({ version: 1, dockviewState: { panels: [] } });
        const layout = yield* repo.getLayout();
        expect(layout?.version).toBe(1);
      }),
    );
  });
});
```

- [ ] **Step 3: Implement repository**

```typescript
// src/api/layout.repository.ts
import { Layer, Effect } from "effect";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { eq } from "drizzle-orm";
import { LayoutRepository, DatabaseError, withTracing } from "@ctrl/core.shared";
import { workspaceLayoutTable } from "../model/workspace-layout.schema";

export const LayoutRepositoryLive = Layer.effect(
  LayoutRepository,
  Effect.gen(function* () {
    const db = yield* SqliteDrizzle;

    return withTracing("LayoutRepository", {
      getLayout: () =>
        Effect.gen(function* () {
          const rows = yield* db
            .select()
            .from(workspaceLayoutTable)
            .where(eq(workspaceLayoutTable.id, "default"));
          if (rows.length === 0) return null;
          const row = rows[0]!;
          return {
            version: row.version,
            dockviewState: JSON.parse(row.dockviewState),
          };
        }).pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new DatabaseError({ message: "Failed to get layout", cause })),
          ),
        ),

      saveLayout: (layout) =>
        db
          .insert(workspaceLayoutTable)
          .values({
            id: "default",
            version: layout.version,
            dockviewState: JSON.stringify(layout.dockviewState),
            updatedAt: new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: workspaceLayoutTable.id,
            set: {
              version: layout.version,
              dockviewState: JSON.stringify(layout.dockviewState),
              updatedAt: new Date().toISOString(),
            },
          })
          .pipe(
            Effect.asVoid,
            Effect.catchAll((cause) =>
              Effect.fail(new DatabaseError({ message: "Failed to save layout", cause })),
            ),
          ),
    });
  }),
);
```

- [ ] **Step 4: Add to DB schema init, update exports, run tests**

- [ ] **Step 5: Commit**

```bash
git add packages/libs/domain.adapter.db packages/libs/core.shared
git commit -m "feat: layout persistence with workspace_layout table"
```

---

### Task 6: Scaffold `domain.service.workspace` with `WorkspaceRpcs`

**Files:**
- Create: `packages/libs/domain.service.workspace/package.json`
- Create: `packages/libs/domain.service.workspace/tsconfig.json`
- Create: `packages/libs/domain.service.workspace/src/index.ts`
- Create: `packages/libs/domain.service.workspace/src/lib/constants.ts`
- Create: `packages/libs/domain.service.workspace/src/api/workspace.rpc.ts`
- Create: `packages/libs/domain.service.workspace/src/api/workspace.handlers.ts`
- Create: `packages/libs/domain.service.workspace/src/api/workspace.rpc.test.ts`

- [ ] **Step 1: Create package scaffold**

Reference: `packages/libs/domain.service.browsing/package.json` for the exact pattern.

Dependencies: `@ctrl/core.shared`, `@ctrl/domain.feature.layout`, `@ctrl/domain.feature.panel`

- [ ] **Step 2: Define WorkspaceRpcs**

```typescript
// src/api/workspace.rpc.ts
import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import { DatabaseError } from "@ctrl/core.shared";
import { PersistedLayoutSchema, LayoutNodeSchema } from "@ctrl/domain.feature.layout";

export class WorkspaceRpcs extends RpcGroup.make(
  Rpc.make("getLayout", {
    success: LayoutNodeSchema,
    error: DatabaseError,
  }),
  Rpc.make("updateLayout", {
    payload: { layout: PersistedLayoutSchema },
    success: Schema.Void,
    error: DatabaseError,
  }),
  Rpc.make("splitPanel", {
    payload: {
      panelId: Schema.String,
      direction: Schema.Literal("horizontal", "vertical"),
      newPanel: PanelRefSchema,
    },
    success: Schema.Void,
    error: DatabaseError,
  }),
  Rpc.make("movePanel", {
    payload: { panelId: Schema.String, targetGroupId: Schema.String },
    success: Schema.Void,
    error: DatabaseError,
  }),
  Rpc.make("closePanel", {
    payload: { panelId: Schema.String },
    success: Schema.Void,
    error: DatabaseError,
  }),
  Rpc.make("workspaceChanges", {
    success: PersistedLayoutSchema,
    stream: true,
  }),
) {}
```

- [ ] **Step 3: Implement handlers**

```typescript
// src/api/workspace.handlers.ts
import { Effect } from "effect";
import { withTracing } from "@ctrl/core.shared";
import { LayoutFeature } from "@ctrl/domain.feature.layout";
import { WorkspaceRpcs } from "./workspace.rpc";
import { WORKSPACE_SERVICE } from "../lib/constants";

export const WorkspaceHandlersLive = WorkspaceRpcs.toLayer(
  Effect.gen(function* () {
    const layout = yield* LayoutFeature;

    return withTracing(WORKSPACE_SERVICE, {
      getLayout: () => layout.getLayout(),
      updateLayout: ({ layout: persistedLayout }) => layout.updateLayout(persistedLayout),
      splitPanel: ({ panelId, direction, newPanel }) =>
        layout.splitPanel(panelId, direction, newPanel),
      movePanel: ({ panelId, targetGroupId }) =>
        layout.movePanel(panelId, targetGroupId),
      closePanel: ({ panelId }) =>
        layout.closePanel(panelId),
      workspaceChanges: () => layout.changes,
    });
  }),
);
```

- [ ] **Step 4: Write tests, run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add packages/libs/domain.service.workspace
git commit -m "feat: WorkspaceRpcs service with layout get/update/stream"
```

---

## Phase 2: Dockview Adapter

### Task 7: Install dockview-core and scaffold `ui.adapter.dockview`

**Files:**
- Create: `packages/libs/ui.adapter.dockview/package.json`
- Create: `packages/libs/ui.adapter.dockview/tsconfig.json`
- Create: `packages/libs/ui.adapter.dockview/src/index.ts`
- Create: `packages/libs/ui.adapter.dockview/src/api/createSolidRenderer.ts`
- Create: `packages/libs/ui.adapter.dockview/src/api/DockviewProvider.tsx`

- [ ] **Step 1: Install dockview-core**

Run: `bun add dockview-core` (at root or in the adapter package)

- [ ] **Step 2: Create package scaffold**

```json
{
  "name": "@ctrl/ui.adapter.dockview",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check": "tsgo --noEmit"
  },
  "dependencies": {
    "dockview-core": "^5.0.0",
    "solid-js": "workspace:*"
  }
}
```

- [ ] **Step 3: Implement createSolidRenderer**

```typescript
// src/api/createSolidRenderer.ts
import { render } from "solid-js/web";
import type { IContentRenderer, GroupPanelPartInitParameters } from "dockview-core";
import type { Component } from "solid-js";

export type PanelProps = {
  params: Record<string, unknown>;
  api: GroupPanelPartInitParameters["api"];
};

export const createSolidRenderer = (
  component: Component<PanelProps>,
): { new (): IContentRenderer } => {
  return class SolidRenderer implements IContentRenderer {
    private _element: HTMLElement;
    private _dispose?: () => void;

    get element(): HTMLElement {
      return this._element;
    }

    constructor() {
      this._element = document.createElement("div");
      this._element.style.height = "100%";
      this._element.style.width = "100%";
    }

    init(parameters: GroupPanelPartInitParameters): void {
      this._dispose = render(
        () => component({ params: parameters.params, api: parameters.api }),
        this._element,
      );
    }

    dispose(): void {
      this._dispose?.();
    }
  };
};
```

- [ ] **Step 4: Implement DockviewProvider**

```typescript
// src/api/DockviewProvider.tsx
import { createEffect, onCleanup, type JSX } from "solid-js";
import { DockviewComponent, type DockviewApi, type SerializedDockview } from "dockview-core";
import type { PanelProps } from "./createSolidRenderer";
import { createSolidRenderer } from "./createSolidRenderer";
import type { Component } from "solid-js";

export type DockviewProviderProps = {
  components: Record<string, Component<PanelProps>>;
  onReady?: (api: DockviewApi) => void;
  onLayoutChange?: (api: DockviewApi) => void;
  initialLayout?: SerializedDockview;
  class?: string;
  gap?: number;
};

export function DockviewProvider(props: DockviewProviderProps): JSX.Element {
  let container: HTMLDivElement | undefined;

  createEffect(() => {
    if (!container) return;

    const renderers = Object.fromEntries(
      Object.entries(props.components).map(([key, comp]) => [
        key,
        createSolidRenderer(comp),
      ]),
    );

    const dockview = new DockviewComponent(container, {
      createComponent: (options) => {
        const Renderer = renderers[options.name];
        if (!Renderer) throw new Error(`Unknown panel: ${options.name}`);
        return new Renderer();
      },
      gap: props.gap,
    });

    if (props.initialLayout) {
      dockview.fromJSON(props.initialLayout);
    }

    props.onReady?.(dockview.api);

    dockview.api.onDidLayoutChange(() => {
      props.onLayoutChange?.(dockview.api);
    });

    onCleanup(() => dockview.dispose());
  });

  return <div ref={container} class={props.class} style={{ height: "100%", width: "100%" }} />;
}
```

- [ ] **Step 5: Create barrel export**

```typescript
// src/index.ts
export { DockviewProvider } from "./api/DockviewProvider";
export { createSolidRenderer } from "./api/createSolidRenderer";
export type { DockviewProviderProps } from "./api/DockviewProvider";
export type { PanelProps } from "./api/createSolidRenderer";
```

- [ ] **Step 6: Verify typecheck**

Run: `cd packages/libs/ui.adapter.dockview && bunx tsgo --noEmit`

- [ ] **Step 7: Commit**

```bash
git add packages/libs/ui.adapter.dockview
git commit -m "feat: dockview-core SolidJS adapter with DockviewProvider"
```

---

## Phase 3: UI Features

### Task 8: Scaffold `ui.feature.workspace` and wire to domain

**Files:**
- Create: `packages/libs/ui.feature.workspace/package.json`
- Create: `packages/libs/ui.feature.workspace/tsconfig.json`
- Create: `packages/libs/ui.feature.workspace/src/index.ts`
- Create: `packages/libs/ui.feature.workspace/src/ui/WorkspaceRoot.tsx`
- Create: `packages/libs/ui.feature.workspace/src/ui/workspace.style.ts`
- Create: `packages/libs/ui.feature.workspace/src/api/use-workspace.ts`

This task wires domain WorkspaceRpcs to the DockviewProvider, connecting layout state ↔ dockview.

- [ ] **Step 1: Create package scaffold**

Dependencies: `@ctrl/core.shared`, `@ctrl/core.ui`, `@ctrl/ui.adapter.dockview`, `@ctrl/domain.feature.layout`, `dockview-core`, `solid-js`

- [ ] **Step 2: Create workspace styles**

```typescript
// src/ui/workspace.style.ts
import { sva } from "@styled-system/css";

export const workspace = sva({
  slots: ["root", "pane", "sash"],
  base: {
    root: {
      display: "flex",
      flex: 1,
      height: "100%",
      overflow: "hidden",
    },
    pane: {
      borderRadius: "10px",
      overflow: "hidden",
      bg: "#1e1e1e",
    },
    sash: {
      bg: "transparent",
      cursor: "col-resize",
    },
  },
});
```

- [ ] **Step 3: Create use-workspace hook**

```typescript
// src/api/use-workspace.ts
import { createSignal, createResource, onCleanup } from "solid-js";
import { useRuntime, useStream } from "@ctrl/core.ui";
import type { DockviewApi, SerializedDockview } from "dockview-core";
import { RpcClient } from "@effect/rpc";
import { WorkspaceRpcs } from "@ctrl/domain.service.workspace";
import { Effect } from "effect";

export const useWorkspace = () => {
  const runtime = useRuntime();

  const ops = {
    getLayout: () =>
      runtime.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(WorkspaceRpcs);
          return yield* client.getLayout();
        }),
      ),
    updateLayout: (dockviewState: SerializedDockview) =>
      runtime.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(WorkspaceRpcs);
          yield* client.updateLayout({ layout: { version: 1, dockviewState } });
        }),
      ),
    splitPanel: (panelId: string, direction: "horizontal" | "vertical", newPanel: PanelRef) =>
      runtime.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(WorkspaceRpcs);
          yield* client.splitPanel({ panelId, direction, newPanel });
        }),
      ),
  };

  // Initial layout fetch
  const [initialLayout] = createResource(() => ops.getLayout());

  // Dockview API ref
  const [dockviewApi, setDockviewApi] = createSignal<DockviewApi | null>(null);

  // RAF-batched layout persistence
  const handleLayoutChange = (api: DockviewApi) => {
    let rafId: number | null = null;
    api.onDidLayoutChange(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        ops.updateLayout(api.toJSON());
        rafId = null;
      });
    });
  };

  const onReady = (api: DockviewApi) => {
    setDockviewApi(api);
    handleLayoutChange(api);
  };

  return { initialLayout, dockviewApi, onReady, ops };
};
```

- [ ] **Step 4: Create WorkspaceRoot component**

```typescript
// src/ui/WorkspaceRoot.tsx
import { Show, type JSX } from "solid-js";
import { DockviewProvider } from "@ctrl/ui.adapter.dockview";
import { workspace } from "./workspace.style";
import { useWorkspace } from "../api/use-workspace";
import { SessionPanel } from "./SessionPanel";
import { EmptyPanel } from "./EmptyPanel";

export type WorkspaceRootProps = {
  children?: JSX.Element;
};

export function WorkspaceRoot(props: WorkspaceRootProps) {
  const $ = workspace();
  const { initialLayout, onReady } = useWorkspace();

  const components = {
    session: SessionPanel,
    empty: EmptyPanel,
  };

  return (
    <div class={$.root}>
      <Show when={!initialLayout.loading}>
        <DockviewProvider
          components={components}
          onReady={onReady}
          onLayoutChange={(api) => {
            // Sidebar will reactively update via workspaceChanges stream
          }}
          initialLayout={initialLayout() as any}
          gap={8}
        />
      </Show>
    </div>
  );
}
```

- [ ] **Step 5: Barrel export, typecheck**

- [ ] **Step 6: Commit**

```bash
git add packages/libs/ui.feature.workspace
git commit -m "feat: ui.feature.workspace with WorkspaceRoot and domain wiring"
```

---

### Task 9: Add `ContextMenu` organism to `core.ui`

**Files:**
- Create: `packages/libs/core.ui/src/components/organisms/ContextMenu/index.ts`
- Create: `packages/libs/core.ui/src/components/organisms/ContextMenu/ui/ContextMenu.tsx`
- Create: `packages/libs/core.ui/src/components/organisms/ContextMenu/ui/contextMenu.style.ts`

- [ ] **Step 1: Create context menu styles with sva()**

```typescript
// ui/contextMenu.style.ts
import { sva } from "@styled-system/css";

export const contextMenu = sva({
  slots: ["root", "item", "icon", "label", "shortcut", "divider"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      minWidth: "200px",
      bg: "#2C2C2E",
      borderRadius: "8px",
      border: "1px solid #48484A",
      padding: "4px 0",
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      zIndex: 100,
    },
    item: {
      display: "flex",
      alignItems: "center",
      height: "32px",
      px: "12px",
      gap: "10px",
      cursor: "pointer",
      color: "#FFFFFF",
      fontSize: "13px",
      fontFamily: "Inter, sans-serif",
      _hover: { bg: "#3A5BA0" },
    },
    icon: { width: "16px", height: "16px", color: "#8E8E93" },
    label: { flex: 1 },
    shortcut: { fontSize: "12px", color: "#666666" },
    divider: { height: "1px", bg: "#48484A", mx: "0" },
  },
});
```

- [ ] **Step 2: Implement ContextMenu component**

Keyboard navigation (arrow keys, Enter, Escape), positioning logic, portal rendering.

- [ ] **Step 3: Export from core.ui barrel**

- [ ] **Step 4: Commit**

```bash
git add packages/libs/core.ui/src/components/organisms/ContextMenu
git commit -m "feat: ContextMenu organism with sva() and keyboard nav"
```

---

### Task 10: Refactor sidebar for tab grouping (TabGroupPills)

**Files:**
- Create: `packages/libs/ui.feature.sidebar/src/ui/TabGroupPills.tsx`
- Create: `packages/libs/ui.feature.sidebar/src/ui/TabPill.tsx`
- Create: `packages/libs/ui.feature.sidebar/src/ui/tabGroupPills.style.ts`
- Modify: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx`
- Modify: `packages/libs/ui.feature.sidebar/src/model/sidebar.bindings.ts`

- [ ] **Step 1: Create pill styles**

```typescript
// src/ui/tabGroupPills.style.ts
import { sva } from "@styled-system/css";

export const tabGroupPills = sva({
  slots: ["container", "pill", "favicon", "title"],
  base: {
    container: {
      display: "flex",
      alignItems: "center",
      gap: "3px",
      padding: "4px",
      bg: "#2A2A2A",
      borderRadius: "8px",
      width: "100%",
      overflow: "hidden",
    },
    pill: {
      display: "flex",
      alignItems: "center",
      gap: "5px",
      px: "6px",
      py: "4px",
      height: "28px",
      borderRadius: "6px",
      cursor: "pointer",
      flexShrink: 0,
    },
    favicon: { width: "14px", height: "14px", borderRadius: "2px", flexShrink: 0 },
    title: { fontSize: "11px", fontFamily: "Inter, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  },
  variants: {
    active: {
      true: {
        pill: { bg: "#3A3A3A" },
        title: { color: "#E8E0D4", fontWeight: "500" },
      },
      false: {
        pill: { bg: "transparent" },
        title: { color: "#8A8A8A" },
      },
    },
  },
  defaultVariants: { active: false },
});
```

- [ ] **Step 2: Implement TabPill component**

- [ ] **Step 3: Implement TabGroupPills component**

Derives groups from layout tree — each `GroupNode` maps to one pill container.

- [ ] **Step 4: Update SidebarFeature to render groups + ungrouped tabs**

- [ ] **Step 5: Commit**

```bash
git add packages/libs/ui.feature.sidebar
git commit -m "feat: sidebar tab grouping with TabGroupPills (Zen-style)"
```

---

### Task 11: Update `AppShellTemplate` and `MainScene` for workspace

**Files:**
- Modify: `packages/libs/core.ui/src/components/templates/AppShellTemplate/ui/AppShellTemplate.tsx`
- Modify: `packages/libs/core.ui/src/components/templates/AppShellTemplate/ui/appShellTemplate.style.ts`
- Modify: `packages/libs/ui.scenes/src/ui/MainScene.tsx`
- Modify: `packages/libs/ui.adapter.electrobun/src/api/SessionWebview.tsx`

- [ ] **Step 1: Update AppShellTemplate styles**

Remove sidebar border in split mode. App background to `#111111`. Content area accepts workspace children.

- [ ] **Step 2: Update MainScene to use WorkspaceRoot**

Replace the current `<For each={sessionIds}>` with `<WorkspaceRoot>` containing `<SessionPanel>` renderers.

- [ ] **Step 3: Update SessionWebview positioning**

Instead of absolute stacking, position webviews per dockview pane geometry using `syncDimensions()` batched via `requestAnimationFrame`.

- [ ] **Step 4: Integration test — build and verify**

Run: `bun run build --force`
Verify: app compiles, no type errors

- [ ] **Step 5: Commit**

```bash
git add packages/libs/core.ui packages/libs/ui.scenes packages/libs/ui.adapter.electrobun
git commit -m "feat: wire workspace into MainScene with pane-based webview positioning"
```

---

### Task 12: Wire desktop app layers and integration test

**Files:**
- Modify: `packages/apps/desktop/src/bun/layers.ts` (add workspace handler layer)
- Modify: `packages/apps/desktop/src/main-ui/layers.ts` (add workspace RPC client)

- [ ] **Step 1: Add WorkspaceHandlersLive to Bun layer stack in `src/bun/layers.ts`**

- [ ] **Step 2: Add workspace RPC client to webview layers in `src/main-ui/layers.ts`**

- [ ] **Step 3: Build and run**

Run: `bun run build --force && bun run dev:desktop:agentic`

- [ ] **Step 4: Visual verification**

```bash
screencapture /tmp/ctrl-page-workspace.png
```

Verify: app launches with workspace layout, sidebar shows tabs, content pane renders webview.

- [ ] **Step 5: Commit**

```bash
git add packages/apps/desktop
git commit -m "feat: wire workspace service into desktop app layer stack"
```

---

## Phase 4: Integration & Polish

### Task 13: Migration logic for existing users

**Files:**
- Modify: `packages/libs/domain.feature.layout/src/api/layout.feature.ts`
- Create: `packages/libs/domain.feature.layout/src/lib/layout.migration.ts`
- Create: `packages/libs/domain.feature.layout/src/lib/layout.migration.test.ts`

On first load with workspace enabled, existing users have no layout state. Bootstrap a single `GroupNode` containing the currently active session.

- [ ] **Step 1: Write migration test**

```typescript
// src/lib/layout.migration.test.ts
import { describe, expect, it } from "vitest";
import { bootstrapDefaultLayout } from "./layout.migration";

describe("Layout Migration", () => {
  it("creates single-pane layout from active session", () => {
    const layout = bootstrapDefaultLayout("session-123");
    expect(layout.type).toBe("group");
    expect(layout.panels).toHaveLength(1);
    expect(layout.panels[0]!.sessionId).toBe("session-123");
    expect(layout.activePanel).toBe(layout.panels[0]!.id);
  });

  it("creates empty group when no active session", () => {
    const layout = bootstrapDefaultLayout(undefined);
    expect(layout.type).toBe("group");
    expect(layout.panels).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement migration**

```typescript
// src/lib/layout.migration.ts
import type { GroupNode, PanelRef } from "../model/layout.validators";

export const bootstrapDefaultLayout = (activeSessionId?: string): GroupNode => {
  if (!activeSessionId) {
    return { type: "group", panels: [], activePanel: "" };
  }
  const panel: PanelRef = {
    id: `panel-${activeSessionId}`,
    type: "session",
    sessionId: activeSessionId,
  };
  return { type: "group", panels: [panel], activePanel: panel.id };
};
```

- [ ] **Step 3: Wire into LayoutFeature.getLayout fallback**

Update `getLayout` in `layout.feature.ts` to call `bootstrapDefaultLayout` when no persisted state exists, passing the active session ID.

- [ ] **Step 4: Run tests, commit**

```bash
git add packages/libs/domain.feature.layout
git commit -m "feat: migration logic for existing users bootstrapping default layout"
```

---

### Task 14: Context menu integration

**Files:**
- Create: `packages/libs/ui.feature.workspace/src/ui/useContextMenu.ts`
- Modify: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx`
- Modify: `packages/libs/ui.feature.workspace/src/ui/WorkspaceRoot.tsx`

- [ ] **Step 1: Create useContextMenu hook**

```typescript
// src/ui/useContextMenu.ts
import { createSignal } from "solid-js";

export type ContextMenuAction =
  | { type: "splitRight"; panelId: string }
  | { type: "splitDown"; panelId: string }
  | { type: "closeTab"; panelId: string }
  | { type: "closeOthers"; panelId: string }
  | { type: "moveToGroup"; panelId: string }
  | { type: "pinTab"; panelId: string };

export const useContextMenu = () => {
  const [position, setPosition] = createSignal<{ x: number; y: number } | null>(null);
  const [targetPanel, setTargetPanel] = createSignal<string | null>(null);

  const open = (e: MouseEvent, panelId: string) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setTargetPanel(panelId);
  };

  const close = () => {
    setPosition(null);
    setTargetPanel(null);
  };

  return { position, targetPanel, open, close };
};
```

- [ ] **Step 2: Wire ContextMenu to sidebar tab right-click and content pane right-click**

- [ ] **Step 3: Connect menu actions to WorkspaceRpcs (splitPanel, closePanel, movePanel)**

- [ ] **Step 4: Visual test — right-click on tab, verify menu appears**

```bash
screencapture /tmp/ctrl-page-contextmenu.png
```

- [ ] **Step 5: Commit**

```bash
git add packages/libs/ui.feature.workspace packages/libs/ui.feature.sidebar
git commit -m "feat: context menu integration with split/close/move actions"
```

---

### Task 15: Layout persistence end-to-end

**Files:**
- Modify: `packages/libs/ui.feature.workspace/src/api/use-workspace.ts`
- Create: `packages/libs/domain.feature.layout/src/lib/layout.fallback.test.ts`

- [ ] **Step 1: Write fallback test for corrupted layout data**

```typescript
// src/lib/layout.fallback.test.ts
import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { PersistedLayoutSchema } from "../model/layout.validators";

describe("Layout Fallback", () => {
  it("rejects corrupted JSON gracefully", () => {
    const result = Schema.decodeUnknownEither(PersistedLayoutSchema)({
      version: "not-a-number",
      dockviewState: null,
    });
    expect(result._tag).toBe("Left");
  });

  it("accepts valid layout", () => {
    const result = Schema.decodeUnknownEither(PersistedLayoutSchema)({
      version: 1,
      dockviewState: { panels: {} },
    });
    expect(result._tag).toBe("Right");
  });
});
```

- [ ] **Step 2: Ensure use-workspace batches syncDimensions via requestAnimationFrame**

In `use-workspace.ts`, wrap dockview's `onDidLayoutChange` handler:

```typescript
let rafId: number | null = null;
dockviewApi.onDidLayoutChange(() => {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    // Sync all webview dimensions
    syncAllWebviewDimensions(dockviewApi);
    // Persist layout
    const serialized = dockviewApi.toJSON();
    workspaceRpc.updateLayout({ layout: { version: 1, dockviewState: serialized } });
    rafId = null;
  });
});
```

- [ ] **Step 3: Test persist/restore cycle manually**

Launch app, split a pane, close app, relaunch — verify layout restored.

- [ ] **Step 4: Commit**

```bash
git add packages/libs/domain.feature.layout packages/libs/ui.feature.workspace
git commit -m "feat: layout persistence with fallback handling and RAF-batched sync"
```

---

### Task 16: Visual polish and screenshot validation

**Files:**
- Modify: `packages/libs/ui.feature.workspace/src/ui/workspace.style.ts`
- Modify: `packages/libs/core.ui/src/components/templates/AppShellTemplate/ui/appShellTemplate.style.ts`

- [ ] **Step 1: Fine-tune pane gaps, border-radius, background colors**

Match design mockup: `cornerRadius: 10`, gap `8px`, pane bg `#1e1e1e`, app bg `#111111`.

- [ ] **Step 2: Style resize sash**

Subtle 2px transparent sash that shows a hover indicator on mouseover.

- [ ] **Step 3: Remove sidebar border in split mode**

Update `appShellTemplate.style.ts` to remove right border when workspace has splits.

- [ ] **Step 4: Build, launch, screenshot**

```bash
bun run build --force
nohup bun run dev:desktop:agentic > /tmp/ctrl-page-dev.log 2>&1 &
sleep 3
osascript -e 'tell application "System Events" to tell process "bun" to set frontmost to true'
sleep 1
screencapture /tmp/ctrl-page-workspace-final.png
```

Then `Read /tmp/ctrl-page-workspace-final.png` to verify visually.

- [ ] **Step 5: Commit**

```bash
git add packages/libs/ui.feature.workspace packages/libs/core.ui
git commit -m "fix: visual polish — pane gaps, border-radius, sidebar border removal"
```
