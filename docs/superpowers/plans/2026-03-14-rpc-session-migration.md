# RPC Bridge + Session Model + Legacy Removal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement @effect/rpc tunnel over Electrobun IPC, migrate tab model to sessions with page history, wire webview with RuntimeProvider, and remove legacy packages.

**Architecture:** @effect/rpc tunnels through Electrobun's message channel. Effect Schema is the single source of truth for types. BrowsingRpcs (RPC group) IS the service contract — no separate Context.Tag. Navigation logic lives in SessionFeature, repository provides persistence primitives.

**Tech Stack:** Effect.ts, @effect/rpc, @effect/schema, @effect/sql-drizzle, Drizzle ORM, SolidJS, Electrobun

**Spec Reference:** `docs/superpowers/specs/2026-03-14-rpc-session-migration-design.md`

**Pre-flight:** Agent MUST read existing files before modifying. Key files: `core.shared/src/index.ts`, `domain.adapter.db/src/`, `domain.feature.tab/src/`, `domain.service.browsing/src/`, `ui.feature.sidebar/src/`, `apps/desktop/src/`.

---

## Chunk 1: Core Types Migration (Tab → Session)

### Task 1: Update core.shared — schemas, ports, constants

**Files:**
- Create: `packages/libs/core.shared/src/model/schemas.ts`
- Modify: `packages/libs/core.shared/src/model/ports.ts`
- Modify: `packages/libs/core.shared/src/model/errors.ts`
- Modify: `packages/libs/core.shared/src/lib/constants.ts`
- Modify: `packages/libs/core.shared/src/index.ts`
- Delete: `packages/libs/core.shared/src/model/types.ts`

- [ ] **Step 1: Create schemas.ts — Effect Schema as single source of truth**

Create `packages/libs/core.shared/src/model/schemas.ts` with `PageSchema`, `SessionSchema`, `BrowsingStateSchema` and derived types (`Page`, `Session`, `BrowsingState`). See spec Section 3.1 for exact schema definitions.

- [ ] **Step 2: Update ports.ts — replace TabRepository with SessionRepository**

Replace `TabRepository` and related constants with `SessionRepository` port. The repository provides low-level persistence primitives: `getAll`, `getById`, `create`, `remove`, `setActive`, `updateCurrentIndex`, `addPage`, `removePagesAfterIndex`, `updatePageTitle`. See spec Section 3.4.

Remove `Tab` type imports — use `Session` and `Page` from `schemas.ts`.

- [ ] **Step 3: Update constants.ts — add session-related constants**

Add `DEFAULT_SESSION_MODE = "visual" as const`. Keep `DEFAULT_TAB_URL` (still used for default page URL). Remove any tab-specific constants that are no longer needed.

- [ ] **Step 4: Delete types.ts — types now derived from schemas**

Delete `packages/libs/core.shared/src/model/types.ts`. All types come from `Schema.Schema.Type<>` in `schemas.ts`.

- [ ] **Step 5: Update index.ts — re-export new schemas and ports**

Update exports: add `schemas.ts` exports, remove `types.ts` exports, update `ports.ts` exports. Ensure `Session`, `Page`, `BrowsingState`, `SessionSchema`, `PageSchema`, `BrowsingStateSchema`, `SessionRepository` are all exported.

- [ ] **Step 6: Verify compilation**

Run: `cd packages/libs/core.shared && bun run check`
Expected: PASS (but downstream packages will break — that's expected, fixed in later tasks)

- [ ] **Step 7: Commit**

```bash
git add packages/libs/core.shared/
git commit -m "feat(core.shared): migrate Tab types to Session with Effect Schema as single source of truth"
```

---

### Task 2: Rename domain.feature.tab → domain.feature.session

**Files:**
- Rename: `packages/libs/domain.feature.tab/` → `packages/libs/domain.feature.session/`
- Modify: `packages/libs/domain.feature.session/package.json`
- Modify: `packages/libs/domain.feature.session/src/lib/constants.ts`
- Modify: `packages/libs/domain.feature.session/src/model/tab.events.ts` → `session.events.ts`
- Modify: `packages/libs/domain.feature.session/src/model/tab.validators.ts` → `session.validators.ts`
- Modify: `packages/libs/domain.feature.session/src/api/tab.service.ts` → `session.service.ts`
- Modify: `packages/libs/domain.feature.session/src/api/tab.service.test.ts` → `session.service.test.ts`
- Modify: `packages/libs/domain.feature.session/src/index.ts`

- [ ] **Step 1: Rename directory and update package.json**

```bash
mv packages/libs/domain.feature.tab packages/libs/domain.feature.session
```

Update `package.json`: name `@ctrl/domain.feature.tab` → `@ctrl/domain.feature.session`.

- [ ] **Step 2: Rename internal files**

```bash
cd packages/libs/domain.feature.session/src
mv model/tab.events.ts model/session.events.ts
mv model/tab.validators.ts model/session.validators.ts
mv api/tab.service.ts api/session.service.ts
mv api/tab.service.test.ts api/session.service.test.ts
```

- [ ] **Step 3: Update constants.ts**

```typescript
export const SESSION_FEATURE = "SessionFeature" as const
```

- [ ] **Step 4: Implement session.service.ts — full session model with navigation**

Rewrite the service from Tab to Session model. Key changes:
- Uses `SessionRepository` instead of `TabRepository`
- Adds `navigate(id, url)` — calls `repo.removePagesAfterIndex`, `repo.addPage`, `repo.updateCurrentIndex`
- Adds `goBack(id)` — validates `canGoBack`, calls `repo.updateCurrentIndex(currentIndex - 1)`
- Adds `goForward(id)` — validates `canGoForward`, calls `repo.updateCurrentIndex(currentIndex + 1)`
- Adds `updateTitle(id, title)` — calls `repo.updatePageTitle`
- PubSub reactivity unchanged — `notify()` with `Effect.ignore` after mutations
- `withTracing(SESSION_FEATURE, {...})`
- See spec Section 5.1 for full interface

- [ ] **Step 5: Add derived accessors in lib/**

Create `packages/libs/domain.feature.session/src/lib/session.helpers.ts` with pure functions: `currentPage`, `canGoBack`, `canGoForward`, `currentUrl`. See spec Section 3.2.

- [ ] **Step 6: Write session navigation tests**

Update `session.service.test.ts`:
- Test `navigate()` appends page, truncates forward history
- Test `goBack()` moves index, fails at 0
- Test `goForward()` moves index, fails at end
- Test history integrity: navigate → back → navigate (forward history truncated)
- Test `create()` publishes to changes stream
- Test `updateTitle()` updates current page title
- Mock `SessionRepository` providing in-memory implementation

- [ ] **Step 7: Run tests**

Run: `cd packages/libs/domain.feature.session && bunx vitest run`
Expected: all tests pass

- [ ] **Step 8: Update index.ts and references**

Update `index.ts` exports. Update `domain.service.browsing/package.json` and `tsconfig.json` references from `domain.feature.tab` → `domain.feature.session`. Update `packages/apps/desktop/package.json` and `tsconfig.json` similarly.

Run: `bun install`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(domain.feature.session): rename from tab, implement session model with page history navigation"
```

---

### Task 3: Update domain.adapter.db — session + pages schema

**Files:**
- Create: `packages/libs/domain.adapter.db/src/model/sessions.schema.ts`
- Create: `packages/libs/domain.adapter.db/src/model/pages.schema.ts`
- Modify: `packages/libs/domain.adapter.db/src/api/tab.repository.ts` → `session.repository.ts`
- Modify: `packages/libs/domain.adapter.db/src/api/tab.repository.test.ts` → `session.repository.test.ts`
- Modify: `packages/libs/domain.adapter.db/src/api/ensure-schema.ts`
- Delete: `packages/libs/domain.adapter.db/src/model/tabs.schema.ts`
- Modify: `packages/libs/domain.adapter.db/src/index.ts`

- [ ] **Step 1: Create sessions.schema.ts and pages.schema.ts**

Two Drizzle table definitions per spec Section 3.3. Validate against domain types using `satisfies`.

- [ ] **Step 2: Update ensure-schema.ts**

Create both `sessions` and `pages` tables. Add foreign key.

- [ ] **Step 3: Write session repository tests (TDD)**

Test all SessionRepository methods:
- Session CRUD: `getAll`, `getById`, `create`, `remove`, `setActive`
- Index management: `updateCurrentIndex`
- Page CRUD: `addPage`, `removePagesAfterIndex`, `updatePageTitle`
- Verify `getAll` returns sessions with pages array reconstructed from ordered rows

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd packages/libs/domain.adapter.db && bunx vitest run`
Expected: FAIL

- [ ] **Step 5: Implement session.repository.ts**

Implement `SessionRepositoryLive` Layer. Key complexity: `getAll()` must join sessions + pages tables and reconstruct `Session` objects with `Page[]` arrays, stripping adapter-internal fields (`id`, `pageIndex`, `sessionId` from pages).

- [ ] **Step 6: Run tests**

Run: `cd packages/libs/domain.adapter.db && bunx vitest run`
Expected: PASS

- [ ] **Step 7: Clean up — remove old tab schema, update index.ts**

Delete `tabs.schema.ts`. Rename/update exports in `index.ts`.

- [ ] **Step 8: Commit**

```bash
git add packages/libs/domain.adapter.db/
git commit -m "feat(domain.adapter.db): implement session + pages schema with SessionRepository"
```

---

## Chunk 2: RPC Adapter + Service Wiring

### Task 4: Implement domain.adapter.rpc — Electrobun tunnel

**Files:**
- Create: `packages/libs/domain.adapter.rpc/src/model/electrobun-rpc.ts`
- Create: `packages/libs/domain.adapter.rpc/src/api/server-protocol.ts`
- Create: `packages/libs/domain.adapter.rpc/src/api/client-protocol.ts`
- Create: `packages/libs/domain.adapter.rpc/src/api/rpc-tunnel.test.ts`
- Modify: `packages/libs/domain.adapter.rpc/src/index.ts`

- [ ] **Step 1: Create ElectrobunRpcHandle type**

Create `src/model/electrobun-rpc.ts` with the structural type matching Electrobun's API. See spec Section 4.3.

- [ ] **Step 2: Write RPC tunnel test (TDD)**

Create `src/api/rpc-tunnel.test.ts`:
- Create mock Electrobun RPC handle (in-memory message bus)
- Test: client sends request → server receives → server responds → client gets response
- Test: streaming works (server sends chunks → client receives stream)
- Use a simple test RPC group (not BrowsingRpcs — adapter is generic)

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/libs/domain.adapter.rpc && bunx vitest run`
Expected: FAIL

- [ ] **Step 4: Implement server-protocol.ts**

`ElectrobunServerProtocol` — implements `RpcServer.Protocol`. See spec Section 4.4. Registers message listener on `"effect-rpc"` channel, forwards to @effect/rpc, sends responses back via Electrobun message.

- [ ] **Step 5: Implement client-protocol.ts**

`ElectrobunClientProtocol` — implements `RpcClient.Protocol`. See spec Section 4.5. Registers message listener, sends requests via Electrobun message.

- [ ] **Step 6: Run tests**

Run: `cd packages/libs/domain.adapter.rpc && bunx vitest run`
Expected: PASS

- [ ] **Step 7: Update index.ts**

```typescript
export { ElectrobunServerProtocol } from "./api/server-protocol"
export { ElectrobunClientProtocol } from "./api/client-protocol"
export type { ElectrobunRpcHandle } from "./model/electrobun-rpc"
```

- [ ] **Step 8: Commit**

```bash
git add packages/libs/domain.adapter.rpc/
git commit -m "feat(domain.adapter.rpc): implement generic Effect↔Electrobun IPC tunnel"
```

---

### Task 5: Update domain.service.browsing — RPC group as contract

**Files:**
- Create: `packages/libs/domain.service.browsing/src/api/browsing.rpc.ts`
- Create: `packages/libs/domain.service.browsing/src/api/browsing.handlers.ts`
- Modify: `packages/libs/domain.service.browsing/src/api/browsing.service.ts`
- Modify: `packages/libs/domain.service.browsing/src/api/browsing.service.test.ts`
- Modify: `packages/libs/domain.service.browsing/src/model/browsing.events.ts`
- Modify: `packages/libs/domain.service.browsing/src/lib/constants.ts`
- Modify: `packages/libs/domain.service.browsing/src/index.ts`
- Modify: `packages/libs/domain.service.browsing/package.json`

- [ ] **Step 1: Create browsing.rpc.ts — the service contract**

Define `BrowsingRpcs` using `RpcGroup.make()` with all methods from spec Section 5.2. This is the single source of truth — no separate BrowsingService Context.Tag.

Add `@ctrl/domain.adapter.rpc` and `@effect/rpc` dependencies.

- [ ] **Step 2: Create browsing.handlers.ts — server-side handler implementation**

Implement the RPC handler Layer that maps each RPC method to `SessionFeature` calls. Uses `withTracing(BROWSING_SERVICE, {...})`.

The `sessionChanges` handler returns the composed Stream from SessionFeature.changes mapped to BrowsingState.

- [ ] **Step 3: Update browsing.service.test.ts — trace assertions with new model**

Update tests: tab → session. Verify trace chain: `BrowsingService.createSession → SessionFeature.create → SessionRepository.create`. Use `spanName()` with `BROWSING_SERVICE` and `SESSION_FEATURE` constants.

- [ ] **Step 4: Run tests**

Run: `cd packages/libs/domain.service.browsing && bunx vitest run`
Expected: PASS

- [ ] **Step 5: Update index.ts**

Export `BrowsingRpcs`, `BrowsingRpcHandlers`, and keep `BROWSING_SERVICE` constant.

- [ ] **Step 6: Commit**

```bash
git add packages/libs/domain.service.browsing/
git commit -m "feat(domain.service.browsing): migrate to RPC group as service contract with session model"
```

---

## Chunk 3: UI Wiring + App Integration

### Task 6: Update ui.feature.sidebar — use RPC client

**Files:**
- Modify: `packages/libs/ui.feature.sidebar/src/model/sidebar.bindings.ts`
- Modify: `packages/libs/ui.feature.sidebar/src/api/use-sidebar.ts`
- Modify: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx`
- Modify: `packages/libs/ui.feature.sidebar/package.json`

- [ ] **Step 1: Update sidebar.bindings.ts**

Map `Session[]` to sidebar items instead of `Tab[]`. Use `currentPage()` helper for display: show current page title/hostname. Add back/forward indicators using `canGoBack`/`canGoForward`.

- [ ] **Step 2: Update use-sidebar.ts**

Use `RpcClient.make(BrowsingRpcs)` instead of `useDomainService(BrowsingService)`. The RPC client provides the typed API directly. Subscribe to `sessionChanges` stream.

- [ ] **Step 3: Update SidebarFeature.tsx**

Update component to use session model. Add navigate, back, forward actions. Use `void runtime.runPromise(...)` for fire-and-forget actions.

- [ ] **Step 4: Update package.json dependencies**

Add `@ctrl/domain.service.browsing` (for BrowsingRpcs import) if not already there.

- [ ] **Step 5: Verify compilation**

Run: `cd packages/libs/ui.feature.sidebar && bun run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/ui.feature.sidebar/
git commit -m "feat(ui.feature.sidebar): migrate to session model with RPC client"
```

---

### Task 7: Wire desktop app — Bun + webview composition roots

**Files:**
- Modify: `packages/apps/desktop/src/bun/layers.ts`
- Modify: `packages/apps/desktop/src/bun/index.ts`
- Modify: `packages/apps/desktop/src/bun/rpc.ts`
- Create: `packages/apps/desktop/src/main-ui/layers.ts`
- Modify: `packages/apps/desktop/src/main-ui/App.tsx`
- Modify: `packages/apps/desktop/src/main-ui/index.ts`
- Modify: `packages/apps/desktop/package.json`

- [ ] **Step 1: Read ALL existing desktop app files**

Pre-flight: read `bun/layers.ts`, `bun/index.ts`, `bun/rpc.ts`, `bun/tab-manager.ts`, `main-ui/App.tsx`, `main-ui/index.ts`, `main-ui/rpc-view.ts` to understand current wiring before modifying.

- [ ] **Step 2: Update bun/layers.ts — new domain layers**

Replace Tab-based layers with Session-based layers. Add RPC server layer. See spec Section 6.1.

- [ ] **Step 3: Update bun/rpc.ts — add effectRpc message channel**

Add `effectRpc` to the Electrobun RPC schema's messages section on both bun and webview sides.

- [ ] **Step 4: Update bun/index.ts — start RPC server**

After creating the ManagedRuntime, start the RPC server so it listens for webview calls. Update migration to create sessions + pages tables.

- [ ] **Step 5: Create main-ui/layers.ts — webview composition root**

New file. Creates the webview Layer with RPC client protocol. See spec Section 6.2.

- [ ] **Step 6: Update main-ui/App.tsx — RuntimeProvider + MainPage**

Replace legacy SidebarTabsWidget with:
```tsx
<RuntimeProvider runtime={webviewRuntime}>
  <MainPage />
</RuntimeProvider>
```

- [ ] **Step 7: Update main-ui/index.ts — create webview runtime**

Create `ManagedRuntime` from `WebviewLive` after Electrobun initializes. Pass to App.

- [ ] **Step 8: Verify build**

Run: `turbo build --filter=@ctrl/desktop`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/apps/desktop/
git commit -m "feat(desktop): wire RPC server on Bun, RPC client on webview, RuntimeProvider + MainPage"
```

---

### Task 8: TabManager → ViewManager

**Files:**
- Rename: `packages/apps/desktop/src/bun/tab-manager.ts` → `view-manager.ts`
- Modify: `packages/apps/desktop/src/bun/index.ts`

- [ ] **Step 1: Rename to view-manager.ts and strip domain logic**

Remove all Tab CRUD logic (database calls, state management). Keep only:
- BrowserView creation/destruction
- BrowserView positioning and resize
- Navigation event handling (URL changes, title changes)
- Active view management (bring to front)

ViewManager receives session state from BrowsingService.changes stream (or via events from the composition root) and syncs BrowserViews accordingly.

- [ ] **Step 2: Update index.ts references**

Replace `TabManager` imports with `ViewManager`.

- [ ] **Step 3: Verify build**

Run: `turbo build --filter=@ctrl/desktop`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/apps/desktop/src/bun/
git commit -m "refactor(desktop): rename TabManager to ViewManager, strip domain logic"
```

---

## Chunk 4: Legacy Removal + Tests + Validation

### Task 9: Remove legacy packages

**Files:**
- Delete: `packages/libs/core.db/`
- Delete: `packages/libs/feature.sidebar-tabs/`
- Modify: `packages/apps/desktop/package.json` (remove refs)
- Modify: `packages/apps/desktop/tsconfig.json` (remove refs)
- Modify: `packages/libs/core.shared/src/rpc-schemas.ts` (gut old schema)

- [ ] **Step 1: Search for all remaining imports of old packages**

Search for `@ctrl/core.db`, `@ctrl/feature.sidebar-tabs`, `TabService`, `TabManager`, old RPC schema types in entire codebase. List all files that still reference them.

- [ ] **Step 2: Update remaining references**

Fix any remaining imports that reference old packages or types.

- [ ] **Step 3: Gut rpc-schemas.ts**

Keep only the `effectRpc` message channel definition. Remove all old request/response/message schemas.

- [ ] **Step 4: Delete legacy packages**

```bash
rm -rf packages/libs/core.db
rm -rf packages/libs/feature.sidebar-tabs
```

- [ ] **Step 5: Workspace cleanup**

Run: `bun install` (cleans lockfile)

- [ ] **Step 6: Verify everything compiles**

Run: `npm run check`
Expected: all packages pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove core.db and feature.sidebar-tabs legacy packages"
```

---

### Task 10: Update pipeline test + full validation

**Files:**
- Modify: `packages/apps/desktop/src/test/test-layers.ts`
- Modify: `packages/apps/desktop/src/test/pipeline.test.ts`

- [ ] **Step 1: Update test-layers.ts**

Replace mock TabRepository with mock SessionRepository. Update PipelineTestLayer to use SessionFeatureLive + BrowsingServiceLive (handler-based).

- [ ] **Step 2: Update pipeline.test.ts**

Test full session flow:
- Create session → navigate to URL → verify stream delivers BrowsingState with session containing page history
- Verify trace chain: BrowsingService → SessionFeature → SessionRepository
- Verify zero errors

- [ ] **Step 3: Run all tests**

Run: `bunx vitest run`
Expected: all tests pass across all packages

- [ ] **Step 4: Run full lint + build**

Run: `npm run check && bunx grit check . && bunx biome check packages/`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: update pipeline test for session model and RPC-based browsing service"
```

---

### Task 11: Update architecture documentation

**Files:**
- Modify: `docs/architecture/package-naming.md`
- Modify: `docs/architecture/dependency-matrix.md`
- Modify: `docs/architecture/testing-strategy.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update docs for session model + RPC**

- Package naming: note `domain.feature.session` (not tab), document RPC adapter role
- Dependency matrix: update with RPC relationships, note BrowsingRpcs as service contract
- Testing strategy: add RPC tunnel test pattern
- CLAUDE.md: update key rules — BrowsingRpcs is the service contract, Effect Schema is single source of truth for types

- [ ] **Step 2: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: update architecture guides for session model and RPC bridge"
```

---

### Task 12: Final validation

- [ ] **Step 1: Run full lint**

Run: `bunx grit check . && bunx biome check packages/`
Expected: 0 violations

- [ ] **Step 2: Run all tests**

Run: `bunx vitest run`
Expected: all pass

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: all packages build

- [ ] **Step 4: Verify no legacy references remain**

Run: search for `@ctrl/core.db`, `@ctrl/feature.sidebar-tabs`, `TabService`, `TabRepository`, `TabFeature`, `TAB_FEATURE` in `packages/`
Expected: zero results

- [ ] **Step 5: Final commit if needed**

```bash
git add -A
git commit -m "chore: final validation for session model + RPC migration"
```
