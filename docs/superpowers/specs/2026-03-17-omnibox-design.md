# Omnibox Design

**Date:** 2026-03-17
**Status:** Draft
**Scope:** `domain.feature.omnibox`, address bar input resolution (URL vs. search), history query recording, `domain.feature.*` file naming correction

---

## 1. Problem Statement

The address bar (`OmniBox` component) accepts raw user input that is either a URL or a search query, but there is no domain-layer logic to classify or resolve it. Typing a search query like "solid js tutorials" is not handled — it either breaks navigation or requires the UI to build search URLs itself, putting domain logic in the wrong layer.

Additionally, all `domain.feature.*` packages incorrectly name their implementation files `*.service.ts`, conflating features with services. `*.service.ts` implies a `domain.service.*` layer file. Features must use `*.feature.ts`.

---

## 2. Scope

**In scope:**
- New package `domain.feature.omnibox` — classifies raw input and resolves it to a navigable URL
- `domain.service.browsing` integration — `navigate` RPC handler uses omnibox resolution
- `HistoryEntry` schema + `query` field — propagated through all layers (schema → port → adapter → DB migration)
- `HistoryFeature.record()` accepts optional `query` parameter
- File rename: `*.service.ts` → `*.feature.ts` in all `domain.feature.*` packages (impl + test files + `index.ts` imports)
- `ui.feature.sidebar` call site update: `navigate({ id, url })` → `navigate({ id, input })`
- `domain.feature.omnibox` uses correct naming from day one

**Out of scope:**
- Multiple search engine support (designed for extensibility, implemented as Google only)
- Global command/shortcut registry (separate spec)
- New UI components (the `OmniBox` component in `core.ui` is already implemented)
- New wiring of `OmniBox` component into `ui.feature.sidebar` layout (separate task)

---

## 3. File Naming Correction

All `domain.feature.*` packages incorrectly name their `api/` implementation files `*.service.ts`. The correct suffix is `*.feature.ts` to reflect the layer.

### 3.1 Renames

| Package | Current | Correct |
|---------|---------|---------|
| `domain.feature.session` | `api/session.service.ts` | `api/session.feature.ts` |
| `domain.feature.session` | `api/session.service.test.ts` | `api/session.feature.test.ts` |
| `domain.feature.bookmark` | `api/bookmark.service.ts` | `api/bookmark.feature.ts` |
| `domain.feature.bookmark` | `api/bookmark.service.test.ts` | `api/bookmark.feature.test.ts` |
| `domain.feature.history` | `api/history.service.ts` | `api/history.feature.ts` |
| `domain.feature.history` | `api/history.service.test.ts` | `api/history.feature.test.ts` |

`domain.service.browsing` files (`browsing.service.ts`, `browsing.handlers.ts`, `browsing.rpc.ts`) are correctly named and unchanged.

### 3.2 Import Updates

Each feature's `index.ts` re-exports from `./api/<name>.service` — these import paths must be updated to `./api/<name>.feature`:

- `domain.feature.session/src/index.ts`
- `domain.feature.bookmark/src/index.ts`
- `domain.feature.history/src/index.ts`

No other packages import the renamed files directly (they import from `index.ts`).

---

## 4. `domain.feature.omnibox`

### 4.1 Package Structure

```
packages/libs/domain.feature.omnibox/src/
  model/
    omnibox.model.ts        ← OmniboxResultSchema, SearchEngine type, OmniboxFeature Context.Tag
  api/
    omnibox.feature.ts      ← OmniboxFeatureLive layer
    omnibox.feature.test.ts
  lib/
    constants.ts            ← OMNIBOX_FEATURE constant
    resolve.ts              ← pure functions: isUrlLike, normalizeUrl, buildSearchUrl
  index.ts
```

### 4.2 Model (`model/omnibox.model.ts`)

`OmniboxResult` is an Effect Schema (project rule: Schema is single source of truth for domain types). The TypeScript type is derived from it.

```typescript
import { Schema } from "@effect/schema"
import { Context } from "effect"
import { OMNIBOX_FEATURE } from "../lib/constants"

export const OmniboxResultSchema = Schema.Struct({
  url: Schema.String,           // final navigable URL (always valid)
  query: Schema.NullOr(Schema.String), // original input if search, null if URL
})
export type OmniboxResult = typeof OmniboxResultSchema.Type

export type SearchEngine = {
  readonly name: string
  readonly buildUrl: (query: string) => string
}

// Context.Tag placed in model/ — it is a port (type-level contract)
export class OmniboxFeature extends Context.Tag(OMNIBOX_FEATURE)<
  OmniboxFeature,
  { resolve: (input: string) => Effect.Effect<OmniboxResult> }
> {}
```

### 4.3 Constants (`lib/constants.ts`)

```typescript
export const OMNIBOX_FEATURE = "OmniboxFeature" as const
```

### 4.4 Resolution Logic (`lib/resolve.ts`)

Pure functions, no Effect, no side effects. These are the authoritative classification rules. The `OmniBox` UI component mirrors a subset of this logic for visual feedback only.

```
isUrlLike(input) → boolean:
  1. Matches /^https?:\/\//i                              → true  (has scheme)
  2. Matches bare domain: /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/  → true
  3. Contains "/" with no spaces                          → true  (path-like)
  4. Matches localhost or localhost:\d+                   → true  (local dev)
  5. Otherwise                                            → false

normalizeUrl(input) → string:
  - If has scheme (https?://) → return as-is
  - If matches localhost pattern → prepend "http://"
  - Otherwise → prepend "https://"

buildSearchUrl(engine, query) → string:
  → engine.buildUrl(encodeURIComponent(query.trim()))
  → e.g. "https://www.google.com/search?q=solid%20js%20tutorials"

resolveInput(input, engine) → OmniboxResult:
  - isUrlLike(input) → { url: normalizeUrl(input), query: null }
  - otherwise        → { url: buildSearchUrl(engine, input), query: input.trim() }
```

### 4.5 Feature Implementation (`api/omnibox.feature.ts`)

`OmniboxFeatureLive` holds the engine config as a layer. Adding engines later means making the engine injectable (e.g., from user settings) without changing the `OmniboxFeature` interface.

```typescript
const GoogleEngine: SearchEngine = {
  name: "Google",
  buildUrl: (query) => `https://www.google.com/search?q=${query}`,
}

export const OmniboxFeatureLive = Layer.succeed(OmniboxFeature, {
  resolve: (input) => Effect.sync(() => resolveInput(input, GoogleEngine)),
})
```

---

## 5. Schema and Data Layer Changes

### 5.1 `HistoryEntry` schema — add `query` field

```typescript
// core.shared/src/model/schemas.ts
export const HistoryEntrySchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  title: Schema.NullOr(Schema.String),
  query: Schema.NullOr(Schema.String),  // ← new: original search query or null
  visitedAt: Schema.String,
})
```

`query` is `null` for direct URL navigations, a non-empty string for search queries.

### 5.2 `HistoryRepository` port — update signature

```typescript
// core.shared/src/model/ports.ts
record(url: string, title: string | null, query?: string | null): Effect<void>
```

### 5.3 Drizzle schema — add `query` column

```typescript
// domain.adapter.db/src/model/history.schema.ts
query: text("query"),   // nullable, no default
```

### 5.4 Database migration

Run `bunx drizzle-kit generate` after updating `history.schema.ts` to produce a new numbered migration file (e.g., `0003_add_history_query.sql`). The migration adds `ALTER TABLE history ADD COLUMN query TEXT`. Commit the generated migration file alongside the schema change.

### 5.5 `HistoryRepositoryLive` — update `record()` and `toHistoryEntry()`

```typescript
// domain.adapter.db/src/api/history.repository.ts
record(url, title, query = null) {
  // INSERT ... (url, title, query, visitedAt)
}

function toHistoryEntry(row): HistoryEntry {
  return { id, url, title, query: row.query ?? null, visitedAt }
}
```

### 5.6 `HistoryFeature.record()` — update signature

```typescript
record(url: string, title: string | null, query?: string | null): Effect<void>
```

The third parameter is optional — all existing call sites that omit it remain valid (`query` defaults to `null`).

---

## 6. `domain.service.browsing` Integration

### 6.1 `navigate` RPC payload — rename `url` → `input`

The field is renamed from `url` to `input` to reflect that it now accepts raw user input (not necessarily a URL).

```typescript
Rpc.make("navigate", {
  payload: Schema.Struct({ id: SessionId, input: Schema.String }),
  success: SessionSchema,
})
```

### 6.2 Handler — compose `OmniboxFeature`

```typescript
// browsing.handlers.ts — navigate handler
const { url, query } = yield* OmniboxFeature.resolve(input)
return yield* SessionFeature.navigate(id, url).pipe(
  Effect.tap(() => HistoryFeature.record(url, null, query))
)
```

`HistoryFeature.record()` is called inside `Effect.tap` so it only runs on successful navigation and the handler still returns `Session`. This matches the existing pattern.

### 6.3 Layer composition

`OmniboxFeatureLive` is added to `BrowsingHandlersLive`'s layer requirements alongside the existing features.

### 6.4 `ui.feature.sidebar` call site

`SidebarFeature.tsx` currently calls `client.navigate({ id: session.id, url })`. This must be updated to:

```typescript
client.navigate({ id: session.id, input: rawInput })
```

The local `looksLikeUrl` / `normalizeUrl` helpers in `SidebarFeature.tsx` (used only to pre-process the navigate input) can be removed — that logic now lives in `domain.feature.omnibox/src/lib/resolve.ts`.

---

## 7. Data Flow

```
OmniBox component
  onSubmit(rawInput)
       │
       ▼
ui.feature.sidebar
  client.navigate({ id, input: rawInput })
       │  RPC over IPC
       ▼
BrowsingHandlersLive (Bun)
  OmniboxFeature.resolve(rawInput)
  → { url: "https://www.google.com/search?q=...", query: "solid js" }
       │
       ├─► SessionFeature.navigate(id, url)           → webview loads url
       └─► (tap) HistoryFeature.record(url, null, query) → stored with original query
```

---

## 8. Testing

### `domain.feature.omnibox` — `lib/resolve.ts`

Pure unit tests, no Effect runtime needed:

| Input | Expected `url` | Expected `query` |
|-------|---------------|-----------------|
| `"https://example.com"` | `"https://example.com"` | `null` |
| `"example.com"` | `"https://example.com"` | `null` |
| `"localhost"` | `"http://localhost"` | `null` |
| `"localhost:3000"` | `"http://localhost:3000"` | `null` |
| `"github.com/user/repo"` | `"https://github.com/user/repo"` | `null` |
| `"solid js tutorials"` | `"https://www.google.com/search?q=solid%20js%20tutorials"` | `"solid js tutorials"` |
| `"what is effect-ts"` | `"https://www.google.com/search?q=what%20is%20effect-ts"` | `"what is effect-ts"` |
| `"  google.com  "` | `"https://google.com"` | `null` |

`api/omnibox.feature.test.ts` tests the Effect service via `OmniboxFeatureLive`.

### `domain.feature.history` — update existing tests

All `HistoryEntry` object literals in `history.feature.test.ts` and `history.repository.test.ts` must include `query: null`. The `record()` call signatures must be updated to accept the optional `query` parameter.

### `domain.service.browsing` — update `browsing.service.test.ts`

- The mock `HistoryRepository.record()` at line 97 must accept the `query` parameter
- All inline `HistoryEntry` constructions must include `query: null`
- The `navigate` RPC call at line 260–262 must use `input` instead of `url`
- `OmniboxFeatureLive` must be added to `TestLayer` — `BrowsingHandlersLive` now requires `OmniboxFeature`

### `domain.adapter.db` — update `history.repository.test.ts`

All `HistoryEntry` object literals must include `query: null`. The `record()` test cases should add a case passing a non-null `query` to verify it persists correctly.
