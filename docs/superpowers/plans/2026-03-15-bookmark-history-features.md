# Bookmark & History Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bookmark and history features to the browsing domain, expose them through BrowsingRpcs, extract `makeFeatureService` factory from the validated patterns, and update BrowsingState to include all three data streams.

**Architecture:** Two new vertical slices (`domain.feature.bookmark`, `domain.feature.history`) following the established hex pattern: Effect Schema → Drizzle table → Repository port → Feature service with PubSub → BrowsingRpcs handler → combined BrowsingState stream. After both features are working, extract the shared pattern into `makeFeatureService` in `core.shared`. History recording is automatic — triggered by navigate in BrowsingHandlers.

**Tech Stack:** Effect.ts, @effect/rpc, @effect/sql-drizzle, Drizzle ORM, Vitest

**Spec Reference:** `docs/superpowers/specs/2026-03-14-domain-architecture-design.md` — Sections 4, 5, 6.3

**Deferred (not in scope):**
- UI features for bookmarks/history (ui.feature.bookmark, ui.feature.history) — next PR
- History search/pagination — simple getAll for now
- core.ui templates (AppShell, SplitView, FocusView) — separate PR
- `SessionFeature` refactor to `makeFeatureService` — SessionFeature has complex logic (navigate, goBack, goForward) beyond simple CRUD; the factory is validated by bookmark + history

**Pre-flight:** Agent MUST read existing `core.shared/src/model/schemas.ts`, `core.shared/src/model/ports.ts`, `domain.feature.session/src/api/session.service.ts`, `domain.service.browsing/src/api/browsing.rpc.ts`, `domain.service.browsing/src/api/browsing.handlers.ts`, and `domain.adapter.db/src/api/session.repository.ts` before modifying them.

---

## Chunk 1: Schemas, Ports, and Drizzle Tables

### Task 1: Add Bookmark and HistoryEntry schemas to core.shared

**Files:**
- Modify: `packages/libs/core.shared/src/model/schemas.ts`

- [ ] **Step 1: Add BookmarkSchema and HistoryEntrySchema**

Add to `packages/libs/core.shared/src/model/schemas.ts`:

```typescript
export const BookmarkSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  title: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
});

export const HistoryEntrySchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  title: Schema.NullOr(Schema.String),
  visitedAt: Schema.String,
});

export type Bookmark = typeof BookmarkSchema.Type;
export type HistoryEntry = typeof HistoryEntrySchema.Type;
```

**Note:** `BrowsingStateSchema` update is deferred to Chunk 3 (Task 11) to avoid breaking downstream compilation before handlers are updated.

- [ ] **Step 2: Verify compilation**

Run: `cd packages/libs/core.shared && bun run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/libs/core.shared/
git commit -m "feat(core.shared): add Bookmark and HistoryEntry schemas, extend BrowsingState"
```

---

### Task 2: Add BookmarkRepository and HistoryRepository ports

**Files:**
- Modify: `packages/libs/core.shared/src/model/ports.ts`

- [ ] **Step 1: Add repository port constants and Context.Tags**

Add to `packages/libs/core.shared/src/model/ports.ts`:

```typescript
import type { Bookmark, HistoryEntry } from "./schemas";

export const BOOKMARK_REPOSITORY_ID = "BookmarkRepository" as const;
export const HISTORY_REPOSITORY_ID = "HistoryRepository" as const;

export class BookmarkRepository extends Context.Tag(BOOKMARK_REPOSITORY_ID)<
  BookmarkRepository,
  {
    readonly getAll: () => Effect.Effect<Bookmark[], DatabaseError>;
    readonly create: (url: string, title: string | null) => Effect.Effect<Bookmark, DatabaseError>;
    readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
    readonly findByUrl: (url: string) => Effect.Effect<Bookmark | undefined, DatabaseError>;
  }
>() {}

export class HistoryRepository extends Context.Tag(HISTORY_REPOSITORY_ID)<
  HistoryRepository,
  {
    readonly getAll: () => Effect.Effect<HistoryEntry[], DatabaseError>;
    readonly record: (url: string, title: string | null) => Effect.Effect<HistoryEntry, DatabaseError>;
    readonly clear: () => Effect.Effect<void, DatabaseError>;
  }
>() {}
```

- [ ] **Step 2: Verify compilation**

Run: `cd packages/libs/core.shared && bun run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/libs/core.shared/
git commit -m "feat(core.shared): add BookmarkRepository and HistoryRepository ports"
```

---

### Task 3: Add Drizzle table schemas for bookmarks and history

**Files:**
- Create: `packages/libs/domain.adapter.db/src/model/bookmarks.schema.ts`
- Create: `packages/libs/domain.adapter.db/src/model/history.schema.ts`

- [ ] **Step 1: Create bookmarks table schema**

Create `packages/libs/domain.adapter.db/src/model/bookmarks.schema.ts`:

```typescript
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const bookmarksTable = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  createdAt: text("createdAt").notNull(),
});
```

- [ ] **Step 2: Create history table schema**

Create `packages/libs/domain.adapter.db/src/model/history.schema.ts`:

```typescript
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const historyTable = sqliteTable("history", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  visitedAt: text("visitedAt").notNull(),
});
```

- [ ] **Step 3: Generate migration**

Run: `cd packages/libs/domain.adapter.db && bunx drizzle-kit generate`
Expected: New migration file created in `src/migrations/`

- [ ] **Step 4: Export new schemas from index.ts**

Add to `packages/libs/domain.adapter.db/src/index.ts`:

```typescript
export { bookmarksTable } from "./model/bookmarks.schema";
export { historyTable } from "./model/history.schema";
```

- [ ] **Step 5: Verify compilation**

Run: `cd packages/libs/domain.adapter.db && bun run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.adapter.db/
git commit -m "feat(domain.adapter.db): add bookmarks and history Drizzle schemas with migration"
```

---

### Task 4: Implement BookmarkRepositoryLive

**Files:**
- Create: `packages/libs/domain.adapter.db/src/api/bookmark.repository.ts`
- Create: `packages/libs/domain.adapter.db/src/api/bookmark.repository.test.ts`
- Modify: `packages/libs/domain.adapter.db/src/index.ts`

- [ ] **Step 1: Write the bookmark repository test**

Create `packages/libs/domain.adapter.db/src/api/bookmark.repository.test.ts`:

```typescript
import { BookmarkRepository, type Bookmark, DatabaseError } from "@ctrl/core.shared";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { LibsqlClient } from "@effect/sql-libsql";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { ensureSchema } from "./ensure-schema";
import { BookmarkRepositoryLive } from "./bookmark.repository";

const makeTestLayer = () => {
  const DbLive = LibsqlClient.layer({ url: "file::memory:" });
  const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbLive));
  const SetupLive = Layer.effectDiscard(ensureSchema).pipe(Layer.provide(DbLive));
  return BookmarkRepositoryLive.pipe(
    Layer.provide(DrizzleLive),
    Layer.provide(DbLive),
    Layer.provide(SetupLive),
  );
};

const run = <A, E>(effect: Effect.Effect<A, E, BookmarkRepository>) =>
  Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("BookmarkRepositoryLive", () => {
  it("getAll returns empty array initially", async () => {
    const result = await run(
      Effect.gen(function* () {
        const repo = yield* BookmarkRepository;
        return yield* repo.getAll();
      }),
    );
    expect(result).toEqual([]);
  });

  it("create adds a bookmark and getAll returns it", async () => {
    const result = await run(
      Effect.gen(function* () {
        const repo = yield* BookmarkRepository;
        const created = yield* repo.create("https://example.com", "Example");
        expect(created.url).toBe("https://example.com");
        expect(created.title).toBe("Example");
        expect(created.id).toBeDefined();
        const all = yield* repo.getAll();
        expect(all).toHaveLength(1);
        return created;
      }),
    );
    expect(result.url).toBe("https://example.com");
  });

  it("remove deletes a bookmark", async () => {
    await run(
      Effect.gen(function* () {
        const repo = yield* BookmarkRepository;
        const created = yield* repo.create("https://example.com", null);
        yield* repo.remove(created.id);
        const all = yield* repo.getAll();
        expect(all).toHaveLength(0);
      }),
    );
  });

  it("findByUrl returns matching bookmark", async () => {
    await run(
      Effect.gen(function* () {
        const repo = yield* BookmarkRepository;
        yield* repo.create("https://example.com", "Example");
        const found = yield* repo.findByUrl("https://example.com");
        expect(found).toBeDefined();
        expect(found?.url).toBe("https://example.com");
        const notFound = yield* repo.findByUrl("https://other.com");
        expect(notFound).toBeUndefined();
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/libs/domain.adapter.db && bunx vitest run src/api/bookmark.repository.test.ts`
Expected: FAIL (BookmarkRepositoryLive not found)

- [ ] **Step 4: Implement BookmarkRepositoryLive**

Create `packages/libs/domain.adapter.db/src/api/bookmark.repository.ts`:

```typescript
import {
  type Bookmark,
  BookmarkRepository,
  DatabaseError,
  withTracing,
} from "@ctrl/core.shared";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { desc, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { bookmarksTable } from "../model/bookmarks.schema";

export const BookmarkRepositoryLive = Layer.effect(
  BookmarkRepository,
  Effect.gen(function* () {
    const db = yield* SqliteDrizzle;
    const now = () => new Date().toISOString();
    const genId = () => crypto.randomUUID();

    return withTracing("BookmarkRepository", {
      getAll: () =>
        db
          .select()
          .from(bookmarksTable)
          .orderBy(desc(bookmarksTable.createdAt))
          .pipe(
            Effect.map((rows) =>
              rows.map(
                (r): Bookmark => ({
                  id: r.id,
                  url: r.url,
                  title: r.title,
                  createdAt: r.createdAt,
                }),
              ),
            ),
            Effect.catchAll((cause) =>
              Effect.fail(new DatabaseError({ message: "Failed to get bookmarks", cause })),
            ),
          ),

      create: (url: string, title: string | null) =>
        Effect.gen(function* () {
          const id = genId();
          const createdAt = now();
          yield* db.insert(bookmarksTable).values({ id, url, title, createdAt });
          return { id, url, title, createdAt } as Bookmark;
        }).pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new DatabaseError({ message: "Failed to create bookmark", cause })),
          ),
        ),

      remove: (id: string) =>
        db
          .delete(bookmarksTable)
          .where(eq(bookmarksTable.id, id))
          .pipe(
            Effect.asVoid,
            Effect.catchAll((cause) =>
              Effect.fail(new DatabaseError({ message: "Failed to remove bookmark", cause })),
            ),
          ),

      findByUrl: (url: string) =>
        db
          .select()
          .from(bookmarksTable)
          .where(eq(bookmarksTable.url, url))
          .pipe(
            Effect.map((rows) =>
              rows.length > 0
                ? ({
                    id: rows[0].id,
                    url: rows[0].url,
                    title: rows[0].title,
                    createdAt: rows[0].createdAt,
                  } as Bookmark)
                : undefined,
            ),
            Effect.catchAll((cause) =>
              Effect.fail(new DatabaseError({ message: "Failed to find bookmark", cause })),
            ),
          ),
    });
  }),
);
```

- [ ] **Step 5: Export from index.ts**

Add to `packages/libs/domain.adapter.db/src/index.ts`:

```typescript
export { BookmarkRepositoryLive } from "./api/bookmark.repository";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/libs/domain.adapter.db && bunx vitest run src/api/bookmark.repository.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/libs/domain.adapter.db/
git commit -m "feat(domain.adapter.db): implement BookmarkRepositoryLive with tests"
```

---

### Task 5: Implement HistoryRepositoryLive

**Files:**
- Create: `packages/libs/domain.adapter.db/src/api/history.repository.ts`
- Create: `packages/libs/domain.adapter.db/src/api/history.repository.test.ts`
- Modify: `packages/libs/domain.adapter.db/src/index.ts`

- [ ] **Step 1: Write the history repository test**

Create `packages/libs/domain.adapter.db/src/api/history.repository.test.ts`:

```typescript
import { HistoryRepository, type HistoryEntry, DatabaseError } from "@ctrl/core.shared";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { LibsqlClient } from "@effect/sql-libsql";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { ensureSchema } from "./ensure-schema";
import { HistoryRepositoryLive } from "./history.repository";

const makeTestLayer = () => {
  const DbLive = LibsqlClient.layer({ url: "file::memory:" });
  const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbLive));
  const SetupLive = Layer.effectDiscard(ensureSchema).pipe(Layer.provide(DbLive));
  return HistoryRepositoryLive.pipe(
    Layer.provide(DrizzleLive),
    Layer.provide(DbLive),
    Layer.provide(SetupLive),
  );
};

const run = <A, E>(effect: Effect.Effect<A, E, HistoryRepository>) =>
  Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("HistoryRepositoryLive", () => {
  it("getAll returns empty initially", async () => {
    const result = await run(
      Effect.gen(function* () {
        const repo = yield* HistoryRepository;
        return yield* repo.getAll();
      }),
    );
    expect(result).toEqual([]);
  });

  it("record adds a history entry", async () => {
    await run(
      Effect.gen(function* () {
        const repo = yield* HistoryRepository;
        const entry = yield* repo.record("https://example.com", "Example");
        expect(entry.url).toBe("https://example.com");
        expect(entry.title).toBe("Example");
        const all = yield* repo.getAll();
        expect(all).toHaveLength(1);
      }),
    );
  });

  it("clear removes all entries", async () => {
    await run(
      Effect.gen(function* () {
        const repo = yield* HistoryRepository;
        yield* repo.record("https://a.com", null);
        yield* repo.record("https://b.com", null);
        yield* repo.clear();
        const all = yield* repo.getAll();
        expect(all).toHaveLength(0);
      }),
    );
  });

  it("getAll returns entries in reverse chronological order", async () => {
    await run(
      Effect.gen(function* () {
        const repo = yield* HistoryRepository;
        yield* repo.record("https://first.com", null);
        yield* repo.record("https://second.com", null);
        const all = yield* repo.getAll();
        expect(all[0].url).toBe("https://second.com");
        expect(all[1].url).toBe("https://first.com");
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/libs/domain.adapter.db && bunx vitest run src/api/history.repository.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement HistoryRepositoryLive**

Create `packages/libs/domain.adapter.db/src/api/history.repository.ts`:

```typescript
import {
  DatabaseError,
  type HistoryEntry,
  HistoryRepository,
  withTracing,
} from "@ctrl/core.shared";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { desc } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { historyTable } from "../model/history.schema";

export const HistoryRepositoryLive = Layer.effect(
  HistoryRepository,
  Effect.gen(function* () {
    const db = yield* SqliteDrizzle;
    const now = () => new Date().toISOString();
    const genId = () => crypto.randomUUID();

    return withTracing("HistoryRepository", {
      getAll: () =>
        db
          .select()
          .from(historyTable)
          .orderBy(desc(historyTable.visitedAt))
          .pipe(
            Effect.map((rows) =>
              rows.map(
                (r): HistoryEntry => ({
                  id: r.id,
                  url: r.url,
                  title: r.title,
                  visitedAt: r.visitedAt,
                }),
              ),
            ),
            Effect.catchAll((cause) =>
              Effect.fail(new DatabaseError({ message: "Failed to get history", cause })),
            ),
          ),

      record: (url: string, title: string | null) =>
        Effect.gen(function* () {
          const id = genId();
          const visitedAt = now();
          yield* db.insert(historyTable).values({ id, url, title, visitedAt });
          return { id, url, title, visitedAt } as HistoryEntry;
        }).pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new DatabaseError({ message: "Failed to record history", cause })),
          ),
        ),

      clear: () =>
        db
          .delete(historyTable)
          .pipe(
            Effect.asVoid,
            Effect.catchAll((cause) =>
              Effect.fail(new DatabaseError({ message: "Failed to clear history", cause })),
            ),
          ),
    });
  }),
);
```

- [ ] **Step 4: Export from index.ts**

Add to `packages/libs/domain.adapter.db/src/index.ts`:

```typescript
export { HistoryRepositoryLive } from "./api/history.repository";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/libs/domain.adapter.db && bunx vitest run src/api/history.repository.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.adapter.db/
git commit -m "feat(domain.adapter.db): implement HistoryRepositoryLive with tests"
```

---

## Chunk 2: Feature Services

### Task 6: Scaffold domain.feature.bookmark package

**Files:**
- Create: `packages/libs/domain.feature.bookmark/package.json`
- Create: `packages/libs/domain.feature.bookmark/tsconfig.json`
- Create: `packages/libs/domain.feature.bookmark/src/index.ts`
- Create: `packages/libs/domain.feature.bookmark/src/lib/constants.ts`

- [ ] **Step 1: Create package.json**

Create `packages/libs/domain.feature.bookmark/package.json`:

```json
{
  "name": "@ctrl/domain.feature.bookmark",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsgo --build",
    "check": "tsgo --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@ctrl/core.shared": "workspace:*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/libs/domain.feature.bookmark/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../core.shared" }
  ]
}
```

- [ ] **Step 3: Create constants**

Create `packages/libs/domain.feature.bookmark/src/lib/constants.ts`:

```typescript
export const BOOKMARK_FEATURE = "BookmarkFeature" as const;
```

- [ ] **Step 4: Create placeholder index.ts**

Create `packages/libs/domain.feature.bookmark/src/index.ts`:

```typescript
export { BOOKMARK_FEATURE } from "./lib/constants";
```

- [ ] **Step 5: Run bun install**

Run: `bun install`
Expected: workspace resolved

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.feature.bookmark/
git commit -m "chore: scaffold domain.feature.bookmark package"
```

---

### Task 7: Implement BookmarkFeature service

**Files:**
- Create: `packages/libs/domain.feature.bookmark/src/api/bookmark.service.ts`
- Create: `packages/libs/domain.feature.bookmark/src/api/bookmark.service.test.ts`
- Modify: `packages/libs/domain.feature.bookmark/src/index.ts`

- [ ] **Step 1: Write the bookmark service test**

Create `packages/libs/domain.feature.bookmark/src/api/bookmark.service.test.ts`:

```typescript
import {
  type Bookmark,
  BookmarkRepository,
  DEFAULT_TAB_URL,
} from "@ctrl/core.shared";
import { Chunk, type Context, Duration, Effect, Fiber, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { BookmarkFeature, BookmarkFeatureLive } from "./bookmark.service";

let nextId = 0;

const makeBookmark = (url: string, title: string | null): Bookmark => ({
  id: String(++nextId),
  url,
  title,
  createdAt: new Date().toISOString(),
});

const makeTestLayer = () => {
  let bookmarks: Bookmark[] = [];
  nextId = 0;

  const MockBookmarkRepository = Layer.succeed(BookmarkRepository, {
    getAll: () => Effect.succeed(bookmarks),
    create: (url: string, title: string | null) =>
      Effect.sync(() => {
        const bookmark = makeBookmark(url, title);
        bookmarks = [...bookmarks, bookmark];
        return bookmark;
      }),
    remove: (id: string) =>
      Effect.sync(() => {
        bookmarks = bookmarks.filter((b) => b.id !== id);
      }),
    findByUrl: (url: string) =>
      Effect.succeed(bookmarks.find((b) => b.url === url)),
  } satisfies Context.Tag.Service<typeof BookmarkRepository>);

  return BookmarkFeatureLive.pipe(Layer.provide(MockBookmarkRepository));
};

const runTest = <A, E>(effect: Effect.Effect<A, E, BookmarkFeature>) =>
  Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("BookmarkFeature", () => {
  it("create() adds bookmark and publishes to changes", async () => {
    await runTest(
      Effect.gen(function* () {
        const feature = yield* BookmarkFeature;

        const fiber = yield* feature.changes.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        );

        yield* Effect.sleep(Duration.millis(10));
        const created = yield* feature.create("https://example.com", "Example");

        const collected = yield* Fiber.join(fiber);
        const snapshots = Chunk.toArray(collected);

        expect(created.url).toBe("https://example.com");
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]).toHaveLength(1);
      }),
    );
  });

  it("remove() deletes bookmark and publishes", async () => {
    await runTest(
      Effect.gen(function* () {
        const feature = yield* BookmarkFeature;
        const created = yield* feature.create("https://example.com", null);

        const fiber = yield* feature.changes.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        );

        yield* Effect.sleep(Duration.millis(10));
        yield* feature.remove(created.id);

        const collected = yield* Fiber.join(fiber);
        const snapshots = Chunk.toArray(collected);

        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]).toHaveLength(0);
      }),
    );
  });

  it("getAll() returns all bookmarks", async () => {
    await runTest(
      Effect.gen(function* () {
        const feature = yield* BookmarkFeature;
        yield* feature.create("https://a.com", "A");
        yield* feature.create("https://b.com", "B");
        const all = yield* feature.getAll();
        expect(all).toHaveLength(2);
      }),
    );
  });

  it("isBookmarked() checks if URL is bookmarked", async () => {
    await runTest(
      Effect.gen(function* () {
        const feature = yield* BookmarkFeature;
        yield* feature.create("https://example.com", "Example");
        const yes = yield* feature.isBookmarked("https://example.com");
        const no = yield* feature.isBookmarked("https://other.com");
        expect(yes).toBe(true);
        expect(no).toBe(false);
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/libs/domain.feature.bookmark && bunx vitest run`
Expected: FAIL

- [ ] **Step 3: Implement BookmarkFeature service**

Create `packages/libs/domain.feature.bookmark/src/api/bookmark.service.ts`:

```typescript
import {
  type Bookmark,
  BookmarkRepository,
  type DatabaseError,
  withTracing,
} from "@ctrl/core.shared";
import { Context, Effect, Layer, PubSub, Stream } from "effect";
import { BOOKMARK_FEATURE } from "../lib/constants";

export class BookmarkFeature extends Context.Tag(BOOKMARK_FEATURE)<
  BookmarkFeature,
  {
    readonly getAll: () => Effect.Effect<Bookmark[], DatabaseError>;
    readonly create: (url: string, title: string | null) => Effect.Effect<Bookmark, DatabaseError>;
    readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
    readonly isBookmarked: (url: string) => Effect.Effect<boolean, DatabaseError>;
    readonly changes: Stream.Stream<Bookmark[]>;
  }
>() {}

export const BookmarkFeatureLive = Layer.effect(
  BookmarkFeature,
  Effect.gen(function* () {
    const repo = yield* BookmarkRepository;
    const pubsub = yield* PubSub.unbounded<Bookmark[]>();

    const notify = () =>
      repo.getAll().pipe(Effect.flatMap((bookmarks) => PubSub.publish(pubsub, bookmarks)));

    return withTracing(BOOKMARK_FEATURE, {
      getAll: () => repo.getAll(),

      create: (url: string, title: string | null) =>
        repo.create(url, title).pipe(Effect.tap(() => notify().pipe(Effect.ignore))),

      remove: (id: string) =>
        repo.remove(id).pipe(Effect.tap(() => notify().pipe(Effect.ignore))),

      isBookmarked: (url: string) =>
        repo.findByUrl(url).pipe(Effect.map((b) => b !== undefined)),

      changes: Stream.fromPubSub(pubsub),
    });
  }),
);
```

- [ ] **Step 4: Update index.ts**

Replace `packages/libs/domain.feature.bookmark/src/index.ts`:

```typescript
export { BookmarkFeature, BookmarkFeatureLive } from "./api/bookmark.service";
export { BOOKMARK_FEATURE } from "./lib/constants";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/libs/domain.feature.bookmark && bunx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.feature.bookmark/
git commit -m "feat(domain.feature.bookmark): implement bookmark service with PubSub reactivity"
```

---

### Task 8: Scaffold domain.feature.history package

**Files:**
- Create: `packages/libs/domain.feature.history/package.json`
- Create: `packages/libs/domain.feature.history/tsconfig.json`
- Create: `packages/libs/domain.feature.history/src/index.ts`
- Create: `packages/libs/domain.feature.history/src/lib/constants.ts`

- [ ] **Step 1: Create package.json**

Create `packages/libs/domain.feature.history/package.json`:

```json
{
  "name": "@ctrl/domain.feature.history",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsgo --build",
    "check": "tsgo --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@ctrl/core.shared": "workspace:*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Same pattern as bookmark — extends root, references core.shared.

- [ ] **Step 3: Create constants**

Create `packages/libs/domain.feature.history/src/lib/constants.ts`:

```typescript
export const HISTORY_FEATURE = "HistoryFeature" as const;
```

- [ ] **Step 4: Create placeholder index.ts**

```typescript
export { HISTORY_FEATURE } from "./lib/constants";
```

- [ ] **Step 5: Run bun install**

Run: `bun install`

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.feature.history/
git commit -m "chore: scaffold domain.feature.history package"
```

---

### Task 9: Implement HistoryFeature service

**Files:**
- Create: `packages/libs/domain.feature.history/src/api/history.service.ts`
- Create: `packages/libs/domain.feature.history/src/api/history.service.test.ts`
- Modify: `packages/libs/domain.feature.history/src/index.ts`

- [ ] **Step 1: Write the history service test**

Create `packages/libs/domain.feature.history/src/api/history.service.test.ts`:

```typescript
import {
  type HistoryEntry,
  HistoryRepository,
} from "@ctrl/core.shared";
import { Chunk, type Context, Duration, Effect, Fiber, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { HistoryFeature, HistoryFeatureLive } from "./history.service";

let nextId = 0;

const makeEntry = (url: string, title: string | null): HistoryEntry => ({
  id: String(++nextId),
  url,
  title,
  visitedAt: new Date().toISOString(),
});

const makeTestLayer = () => {
  let entries: HistoryEntry[] = [];
  nextId = 0;

  const MockHistoryRepository = Layer.succeed(HistoryRepository, {
    getAll: () => Effect.succeed(entries),
    record: (url: string, title: string | null) =>
      Effect.sync(() => {
        const entry = makeEntry(url, title);
        entries = [...entries, entry];
        return entry;
      }),
    clear: () =>
      Effect.sync(() => {
        entries = [];
      }),
  } satisfies Context.Tag.Service<typeof HistoryRepository>);

  return HistoryFeatureLive.pipe(Layer.provide(MockHistoryRepository));
};

const runTest = <A, E>(effect: Effect.Effect<A, E, HistoryFeature>) =>
  Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("HistoryFeature", () => {
  it("record() adds entry and publishes to changes", async () => {
    await runTest(
      Effect.gen(function* () {
        const feature = yield* HistoryFeature;

        const fiber = yield* feature.changes.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        );

        yield* Effect.sleep(Duration.millis(10));
        const entry = yield* feature.record("https://example.com", "Example");

        const collected = yield* Fiber.join(fiber);
        const snapshots = Chunk.toArray(collected);

        expect(entry.url).toBe("https://example.com");
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]).toHaveLength(1);
      }),
    );
  });

  it("getAll() returns all entries", async () => {
    await runTest(
      Effect.gen(function* () {
        const feature = yield* HistoryFeature;
        yield* feature.record("https://a.com", null);
        yield* feature.record("https://b.com", null);
        const all = yield* feature.getAll();
        expect(all).toHaveLength(2);
      }),
    );
  });

  it("clear() removes all entries and publishes", async () => {
    await runTest(
      Effect.gen(function* () {
        const feature = yield* HistoryFeature;
        yield* feature.record("https://example.com", null);

        const fiber = yield* feature.changes.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        );

        yield* Effect.sleep(Duration.millis(10));
        yield* feature.clear();

        const collected = yield* Fiber.join(fiber);
        const snapshots = Chunk.toArray(collected);

        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]).toHaveLength(0);
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/libs/domain.feature.history && bunx vitest run`
Expected: FAIL

- [ ] **Step 3: Implement HistoryFeature service**

Create `packages/libs/domain.feature.history/src/api/history.service.ts`:

```typescript
import {
  type DatabaseError,
  type HistoryEntry,
  HistoryRepository,
  withTracing,
} from "@ctrl/core.shared";
import { Context, Effect, Layer, PubSub, Stream } from "effect";
import { HISTORY_FEATURE } from "../lib/constants";

export class HistoryFeature extends Context.Tag(HISTORY_FEATURE)<
  HistoryFeature,
  {
    readonly getAll: () => Effect.Effect<HistoryEntry[], DatabaseError>;
    readonly record: (url: string, title: string | null) => Effect.Effect<HistoryEntry, DatabaseError>;
    readonly clear: () => Effect.Effect<void, DatabaseError>;
    readonly changes: Stream.Stream<HistoryEntry[]>;
  }
>() {}

export const HistoryFeatureLive = Layer.effect(
  HistoryFeature,
  Effect.gen(function* () {
    const repo = yield* HistoryRepository;
    const pubsub = yield* PubSub.unbounded<HistoryEntry[]>();

    const notify = () =>
      repo.getAll().pipe(Effect.flatMap((entries) => PubSub.publish(pubsub, entries)));

    return withTracing(HISTORY_FEATURE, {
      getAll: () => repo.getAll(),

      record: (url: string, title: string | null) =>
        repo.record(url, title).pipe(Effect.tap(() => notify().pipe(Effect.ignore))),

      clear: () =>
        repo.clear().pipe(Effect.tap(() => notify().pipe(Effect.ignore))),

      changes: Stream.fromPubSub(pubsub),
    });
  }),
);
```

- [ ] **Step 4: Update index.ts**

```typescript
export { HistoryFeature, HistoryFeatureLive } from "./api/history.service";
export { HISTORY_FEATURE } from "./lib/constants";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/libs/domain.feature.history && bunx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.feature.history/
git commit -m "feat(domain.feature.history): implement history service with PubSub reactivity"
```

---

## Chunk 3: BrowsingRpcs Integration

### Task 10: Update BrowsingRpcs, BrowsingStateSchema, and handlers together

**Files:**
- Modify: `packages/libs/core.shared/src/model/schemas.ts`
- Modify: `packages/libs/domain.service.browsing/src/api/browsing.rpc.ts`
- Modify: `packages/libs/domain.service.browsing/src/api/browsing.handlers.ts`
- Modify: `packages/libs/domain.service.browsing/package.json`

**Why atomic:** `BrowsingStateSchema` change, new RPC definitions, and handler updates must happen together to avoid breaking compilation between tasks.

- [ ] **Step 1: Add dependency on new feature packages**

Add to `packages/libs/domain.service.browsing/package.json` dependencies:

```json
"@ctrl/domain.feature.bookmark": "workspace:*",
"@ctrl/domain.feature.history": "workspace:*"
```

Run: `bun install`

- [ ] **Step 2: Update BrowsingStateSchema in core.shared**

Update `packages/libs/core.shared/src/model/schemas.ts` — replace the existing `BrowsingStateSchema`:

```typescript
export const BrowsingStateSchema = Schema.Struct({
  sessions: Schema.Array(SessionSchema),
  bookmarks: Schema.Array(BookmarkSchema),
  history: Schema.Array(HistoryEntrySchema),
});
```

- [ ] **Step 3: Add bookmark/history RPCs and rename sessionChanges → browsingChanges**

Replace the full `RpcGroup.make(...)` call in `packages/libs/domain.service.browsing/src/api/browsing.rpc.ts`:

```typescript
import {
  BookmarkSchema,
  BrowsingStateSchema,
  DatabaseError,
  HistoryEntrySchema,
  SessionSchema,
  ValidationError,
} from "@ctrl/core.shared";
import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";

export class BrowsingRpcs extends RpcGroup.make(
  // Session RPCs (existing)
  Rpc.make("createSession", {
    payload: { mode: Schema.Literal("visual") },
    success: SessionSchema,
    error: DatabaseError,
  }),
  Rpc.make("removeSession", {
    payload: { id: Schema.String },
    success: Schema.Void,
    error: DatabaseError,
  }),
  Rpc.make("navigate", {
    payload: { id: Schema.String, url: Schema.String },
    success: SessionSchema,
    error: Schema.Union(DatabaseError, ValidationError),
  }),
  Rpc.make("goBack", {
    payload: { id: Schema.String },
    success: SessionSchema,
    error: Schema.Union(DatabaseError, ValidationError),
  }),
  Rpc.make("goForward", {
    payload: { id: Schema.String },
    success: SessionSchema,
    error: Schema.Union(DatabaseError, ValidationError),
  }),
  Rpc.make("getSessions", {
    success: Schema.Array(SessionSchema),
    error: DatabaseError,
  }),
  Rpc.make("setActive", {
    payload: { id: Schema.String },
    success: Schema.Void,
    error: DatabaseError,
  }),
  Rpc.make("updateTitle", {
    payload: { id: Schema.String, title: Schema.String },
    success: SessionSchema,
    error: Schema.Union(DatabaseError, ValidationError),
  }),
  // Bookmark RPCs (new)
  Rpc.make("getBookmarks", {
    success: Schema.Array(BookmarkSchema),
    error: DatabaseError,
  }),
  Rpc.make("addBookmark", {
    payload: { url: Schema.String, title: Schema.NullOr(Schema.String) },
    success: BookmarkSchema,
    error: DatabaseError,
  }),
  Rpc.make("removeBookmark", {
    payload: { id: Schema.String },
    success: Schema.Void,
    error: DatabaseError,
  }),
  Rpc.make("isBookmarked", {
    payload: { url: Schema.String },
    success: Schema.Boolean,
    error: DatabaseError,
  }),
  // History RPCs (new)
  Rpc.make("getHistory", {
    success: Schema.Array(HistoryEntrySchema),
    error: DatabaseError,
  }),
  Rpc.make("clearHistory", {
    success: Schema.Void,
    error: DatabaseError,
  }),
  // Combined state stream (renamed from sessionChanges)
  Rpc.make("browsingChanges", {
    success: BrowsingStateSchema,
    stream: true,
  }),
) {}
```

---

- [ ] **Step 4: Update BrowsingHandlers to use bookmark and history features**

Replace `packages/libs/domain.service.browsing/src/api/browsing.handlers.ts`:

```typescript
import { withTracing } from "@ctrl/core.shared";
import { BookmarkFeature } from "@ctrl/domain.feature.bookmark";
import { HistoryFeature } from "@ctrl/domain.feature.history";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { Effect, Stream } from "effect";
import { BROWSING_SERVICE } from "../lib/constants";
import type { BrowsingState } from "../model/browsing.events";
import { BrowsingRpcs } from "./browsing.rpc";

export const BrowsingHandlersLive = BrowsingRpcs.toLayer(
  Effect.gen(function* () {
    const sessions = yield* SessionFeature;
    const bookmarks = yield* BookmarkFeature;
    const history = yield* HistoryFeature;

    return withTracing(BROWSING_SERVICE, {
      createSession: ({ mode }: { readonly mode: "visual" }) =>
        sessions.create(mode).pipe(Effect.tap((s) => sessions.setActive(s.id))),
      removeSession: ({ id }: { readonly id: string }) => sessions.remove(id),
      navigate: ({ id, url }: { readonly id: string; readonly url: string }) =>
        sessions.navigate(id, url).pipe(
          Effect.tap(() => history.record(url, null).pipe(Effect.ignore)),
        ),
      goBack: ({ id }: { readonly id: string }) => sessions.goBack(id),
      goForward: ({ id }: { readonly id: string }) => sessions.goForward(id),
      getSessions: () => sessions.getAll(),
      setActive: ({ id }: { readonly id: string }) => sessions.setActive(id),
      updateTitle: ({ id, title }: { readonly id: string; readonly title: string }) =>
        sessions.updateTitle(id, title),

      // Bookmark handlers
      getBookmarks: () => bookmarks.getAll(),
      addBookmark: ({ url, title }: { readonly url: string; readonly title: string | null }) =>
        bookmarks.create(url, title),
      removeBookmark: ({ id }: { readonly id: string }) => bookmarks.remove(id),
      isBookmarked: ({ url }: { readonly url: string }) => bookmarks.isBookmarked(url),

      // History handlers
      getHistory: () => history.getAll(),
      clearHistory: () => history.clear(),

      // Combined state stream — zipLatest emits when ANY source updates
      // Per spec Section 5.5: combineLatest gives complete snapshot from all sources.
      // Each stream is prepended with an initial getAll() so zipLatest doesn't
      // block waiting for a mutation on all three features.
      browsingChanges: () => {
        const s$ = Stream.concat(Stream.fromEffect(sessions.getAll()), sessions.changes);
        const b$ = Stream.concat(Stream.fromEffect(bookmarks.getAll()), bookmarks.changes);
        const h$ = Stream.concat(Stream.fromEffect(history.getAll()), history.changes);
        return Stream.zipLatest(Stream.zipLatest(s$, b$), h$).pipe(
          Stream.map(([[s, b], h]): BrowsingState => ({
            sessions: s,
            bookmarks: b,
            history: h,
          })),
        );
      },
    });
  }),
);
```

**Note on `Stream.zipLatest`:** Effect's `Stream.zipLatest` is the equivalent of RxJS `combineLatest` — it emits the latest value from ALL streams whenever ANY one updates. Each feature's `changes` stream is prepended with `Stream.fromEffect(feature.getAll())` so the combined stream emits immediately with current state, without waiting for a mutation on all three features.

- [ ] **Step 5: Verify compilation**

Run: `cd packages/libs/domain.service.browsing && bun run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/core.shared/ packages/libs/domain.service.browsing/
git commit -m "feat(domain.service.browsing): add bookmark/history RPCs, rename sessionChanges → browsingChanges"
```

---

### Task 11: Update browsing service tests

**Files:**
- Modify: `packages/libs/domain.service.browsing/src/api/browsing.service.test.ts`

- [ ] **Step 1: Add mock bookmark and history repos + feature layers to test setup**

Update the test file:
1. Add mock `BookmarkRepository` and `HistoryRepository` layers following the same `Layer.succeed(Tag, { ... })` pattern as `MockSessionRepository`
2. Add `BookmarkFeatureLive` and `HistoryFeatureLive` to `TestLayer`
3. Rename `sessionChanges` references to `browsingChanges`
4. Update the `browsingChanges` stream test to verify the combined state includes `bookmarks` and `history` fields

Add trace assertions for:
- `addBookmark` traces through `BookmarkFeature.create`
- `navigate` traces through both `SessionFeature.navigate` and `HistoryFeature.record`
- `clearHistory` traces through `HistoryFeature.clear`

- [ ] **Step 2: Run tests**

Run: `cd packages/libs/domain.service.browsing && bunx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/libs/domain.service.browsing/
git commit -m "test(domain.service.browsing): add bookmark and history trace assertions"
```

---

## Chunk 4: Desktop App Wiring + Factory Extraction

### Task 13: Update desktop app layers to include bookmark and history

**Files:**
- Modify: `packages/apps/desktop/src/bun/layers.ts`
- Modify: `packages/apps/desktop/package.json`

- [ ] **Step 1: Add feature dependencies to desktop package.json**

Add to `packages/apps/desktop/package.json` dependencies:

```json
"@ctrl/domain.feature.bookmark": "workspace:*",
"@ctrl/domain.feature.history": "workspace:*"
```

Run: `bun install`

- [ ] **Step 2: Update layers.ts to include new feature + repository layers**

Modify `packages/apps/desktop/src/bun/layers.ts`:

```typescript
import { homedir } from "node:os";
import { join } from "node:path";
import {
  BookmarkRepositoryLive,
  HistoryRepositoryLive,
  makeDbClient,
  SessionRepositoryLive,
} from "@ctrl/domain.adapter.db";
import { BookmarkFeatureLive } from "@ctrl/domain.feature.bookmark";
import { HistoryFeatureLive } from "@ctrl/domain.feature.history";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import { BrowsingHandlersLive } from "@ctrl/domain.service.browsing";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { Layer } from "effect";

const dbPath = join(homedir(), ".ctrl.page", "data.db");

// Infrastructure: libsql client -> Drizzle ORM
const DbClientLive = makeDbClient(`file:${dbPath}`);
const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbClientLive));

// Repositories
const SessionRepositoryLayer = SessionRepositoryLive.pipe(Layer.provide(DrizzleLive));
const BookmarkRepositoryLayer = BookmarkRepositoryLive.pipe(Layer.provide(DrizzleLive));
const HistoryRepositoryLayer = HistoryRepositoryLive.pipe(Layer.provide(DrizzleLive));

// Features
const SessionFeatureLayer = SessionFeatureLive.pipe(Layer.provide(SessionRepositoryLayer));
const BookmarkFeatureLayer = BookmarkFeatureLive.pipe(Layer.provide(BookmarkRepositoryLayer));
const HistoryFeatureLayer = HistoryFeatureLive.pipe(Layer.provide(HistoryRepositoryLayer));

// Composed service
const BrowsingHandlersLayer = BrowsingHandlersLive.pipe(
  Layer.provide(SessionFeatureLayer),
  Layer.provide(BookmarkFeatureLayer),
  Layer.provide(HistoryFeatureLayer),
);

// Compose: expose all layers needed by the app
export const DesktopLive = Layer.mergeAll(DbClientLive, BrowsingHandlersLayer);
export type AppLayer = Layer.Layer.Success<typeof DesktopLive>;
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/apps/desktop/
git commit -m "feat(desktop): wire bookmark and history features into desktop layer stack"
```

---

### Task 14: Update pipeline test

**Files:**
- Modify: `packages/apps/desktop/src/test/pipeline.test.ts`

- [ ] **Step 1: Read current pipeline test**

Read `packages/apps/desktop/src/test/pipeline.test.ts` to understand current structure.

- [ ] **Step 2: Add bookmark and history feature layers + trace assertions**

Update the `PipelineTestLayer` to include `BookmarkFeatureLive` + `HistoryFeatureLive` with mock repositories. Add pipeline trace assertions for:
- Navigate flow: `BrowsingService.navigate → SessionFeature.navigate + HistoryFeature.record`
- Bookmark flow: `BrowsingService.addBookmark → BookmarkFeature.create`

- [ ] **Step 3: Run pipeline test**

Run: `bunx vitest run packages/apps/desktop/src/test/pipeline.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/apps/desktop/src/test/
git commit -m "test: update pipeline test with bookmark and history trace assertions"
```

---

### Task 15: Extract makeFeatureService factory

**Files:**
- Create: `packages/libs/core.shared/src/lib/make-feature-service.ts`
- Modify: `packages/libs/core.shared/src/index.ts`

- [ ] **Step 1: Identify the common pattern**

All three feature services (Session, Bookmark, History) follow this pattern:
1. `Layer.effect(Tag, Effect.gen(...))`
2. `yield* Repository`
3. `PubSub.unbounded<T[]>()`
4. `notify = () => repo.getAll().pipe(Effect.flatMap(items => PubSub.publish(pubsub, items)))`
5. `withTracing(NAME, { getAll, ...mutations that call notify, changes: Stream.fromPubSub(pubsub) })`

The factory extracts steps 2-5 for the common CRUD subset.

- [ ] **Step 2: Write makeFeatureService**

Create `packages/libs/core.shared/src/lib/make-feature-service.ts`:

```typescript
import { Context, Effect, Layer, PubSub, Stream } from "effect";
import { withTracing } from "./with-tracing";

/**
 * Factory for creating feature services with PubSub reactivity.
 *
 * Extracts the common pattern: repository → PubSub → notify-on-mutate → Stream.
 * Custom methods are added via the `extend` callback which receives `repo` and `notify`.
 *
 * Usage:
 * ```typescript
 * const BookmarkFeatureLive = makeFeatureService({
 *   tag: BookmarkFeature,
 *   repoTag: BookmarkRepository,
 *   name: BOOKMARK_FEATURE,
 *   extend: (repo, notify) => ({
 *     create: (url, title) => repo.create(url, title).pipe(Effect.tap(() => notify())),
 *     remove: (id) => repo.remove(id).pipe(Effect.tap(() => notify())),
 *     isBookmarked: (url) => repo.findByUrl(url).pipe(Effect.map(b => b !== undefined)),
 *   }),
 * })
 * ```
 */
export const makeFeatureService = <
  TagId,
  TagService extends { readonly getAll: () => Effect.Effect<any, any>; readonly changes: Stream.Stream<any> },
  RepoId,
  RepoService extends { readonly getAll: () => Effect.Effect<any, any> },
  Ext extends Record<string, unknown>,
>(config: {
  readonly tag: Context.Tag<TagId, TagService>;
  readonly repoTag: Context.Tag<RepoId, RepoService>;
  readonly name: string;
  readonly extend: (
    repo: RepoService,
    notify: () => Effect.Effect<void, never, never>,
  ) => Ext;
}) =>
  Layer.effect(
    config.tag,
    Effect.gen(function* () {
      const repo = yield* config.repoTag;
      type Item = ReturnType<RepoService["getAll"]> extends Effect.Effect<infer A, any> ? A extends (infer I)[] ? I : never : never;
      const pubsub = yield* PubSub.unbounded<Item[]>();

      const notify = () =>
        (repo.getAll() as Effect.Effect<Item[], any>).pipe(
          Effect.flatMap((items) => PubSub.publish(pubsub, items)),
          Effect.ignore,
        );

      const extended = config.extend(repo, notify);

      return withTracing(config.name, {
        getAll: () => repo.getAll(),
        ...extended,
        changes: Stream.fromPubSub(pubsub),
      }) as unknown as TagService;
    }),
  );
```

- [ ] **Step 3: Export from core.shared index**

Add to `packages/libs/core.shared/src/index.ts`:

```typescript
export { makeFeatureService } from "./lib/make-feature-service";
```

- [ ] **Step 4: Verify compilation**

Run: `cd packages/libs/core.shared && bun run check`
Expected: PASS

- [ ] **Step 5: Refactor BookmarkFeatureLive to use makeFeatureService**

Update `packages/libs/domain.feature.bookmark/src/api/bookmark.service.ts` to use the factory:

```typescript
import {
  type Bookmark,
  BookmarkRepository,
  type DatabaseError,
  makeFeatureService,
} from "@ctrl/core.shared";
import { Context, Effect, Stream } from "effect";
import { BOOKMARK_FEATURE } from "../lib/constants";

export class BookmarkFeature extends Context.Tag(BOOKMARK_FEATURE)<
  BookmarkFeature,
  {
    readonly getAll: () => Effect.Effect<Bookmark[], DatabaseError>;
    readonly create: (url: string, title: string | null) => Effect.Effect<Bookmark, DatabaseError>;
    readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
    readonly isBookmarked: (url: string) => Effect.Effect<boolean, DatabaseError>;
    readonly changes: Stream.Stream<Bookmark[]>;
  }
>() {}

export const BookmarkFeatureLive = makeFeatureService({
  tag: BookmarkFeature,
  repoTag: BookmarkRepository,
  name: BOOKMARK_FEATURE,
  extend: (repo, notify) => ({
    create: (url: string, title: string | null) =>
      repo.create(url, title).pipe(Effect.tap(() => notify())),
    remove: (id: string) =>
      repo.remove(id).pipe(Effect.tap(() => notify())),
    isBookmarked: (url: string) =>
      repo.findByUrl(url).pipe(Effect.map((b) => b !== undefined)),
  }),
});
```

- [ ] **Step 6: Refactor HistoryFeatureLive to use makeFeatureService**

Same pattern — update `packages/libs/domain.feature.history/src/api/history.service.ts`:

```typescript
import {
  type DatabaseError,
  type HistoryEntry,
  HistoryRepository,
  makeFeatureService,
} from "@ctrl/core.shared";
import { Context, Effect, Stream } from "effect";
import { HISTORY_FEATURE } from "../lib/constants";

export class HistoryFeature extends Context.Tag(HISTORY_FEATURE)<
  HistoryFeature,
  {
    readonly getAll: () => Effect.Effect<HistoryEntry[], DatabaseError>;
    readonly record: (url: string, title: string | null) => Effect.Effect<HistoryEntry, DatabaseError>;
    readonly clear: () => Effect.Effect<void, DatabaseError>;
    readonly changes: Stream.Stream<HistoryEntry[]>;
  }
>() {}

export const HistoryFeatureLive = makeFeatureService({
  tag: HistoryFeature,
  repoTag: HistoryRepository,
  name: HISTORY_FEATURE,
  extend: (repo, notify) => ({
    record: (url: string, title: string | null) =>
      repo.record(url, title).pipe(Effect.tap(() => notify())),
    clear: () =>
      repo.clear().pipe(Effect.tap(() => notify())),
  }),
});
```

- [ ] **Step 7: Run all feature tests to verify refactor didn't break anything**

Run: `bunx vitest run`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add packages/libs/core.shared/ packages/libs/domain.feature.bookmark/ packages/libs/domain.feature.history/
git commit -m "feat(core.shared): extract makeFeatureService factory, refactor bookmark and history to use it"
```

---

### Task 16: Update UI sidebar for browsingChanges rename

**Files:**
- Modify: `packages/libs/ui.feature.sidebar/src/api/use-sidebar.ts`

- [ ] **Step 1: Update sessionChanges → browsingChanges in use-sidebar.ts**

In `packages/libs/ui.feature.sidebar/src/api/use-sidebar.ts` (line 32), update the RPC call:

```typescript
// Before:
const sessionStream = client.sessionChanges().pipe(Stream.catchAll(() => Stream.empty));

// After:
const sessionStream = client.browsingChanges().pipe(Stream.catchAll(() => Stream.empty));
```

The rest of the hook continues to work — `state()?.sessions` is still a valid field on `BrowsingState`.

- [ ] **Step 2: Verify compilation**

Run: `cd packages/libs/ui.feature.sidebar && bun run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/libs/ui.feature.sidebar/
git commit -m "refactor(ui.feature.sidebar): update to browsingChanges RPC rename"
```

---

### Task 17: Final validation

- [ ] **Step 1: Run all tests**

Run: `bunx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Run GritQL boundary check**

Run: `bunx grit check .`
Expected: PASS (no boundary violations)

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final validation fixes for bookmark and history features"
```
