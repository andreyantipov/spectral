# Sidebar & Webview Integration Rework

**Date:** 2026-03-18
**Status:** Draft
**Scope:** Sidebar cleanup, webview adapter, title/URL tracking, app icon

## 1. Problem Statement

The current sidebar has half-baked bookmarks/history tabs that don't function. The "SESSIONS" header wastes space that could house an omnibox input. Tab titles are always `null` because no webview events are captured. Switching sessions destroys and recreates the webview, losing page state. The `<electrobun-webview>` tag leaks into `core.ui`, violating the platform-agnostic boundary.

## 2. Goals

1. Clean sidebar: remove non-functional bookmarks/history tabs, add omnibox input in header
2. Proper webview abstraction: isolate all Electrobun webview specifics behind `ui.adapter.electrobun`
3. Fix title/URL tracking: capture navigation events from the webview and persist them
4. Session switching without view destruction: show/hide webview instances instead of recreating
5. App icon: wire macOS `.icns` icon into the build

## 3. Out of Scope

- Bookmarks/history panel UI (deferred — will be improved later)
- Multi-window / tile manager support (separate spec)
- Non-macOS icon formats

## 4. Architecture

### 4.1 New Package: `ui.adapter.electrobun`

A new UI adapter tier, mirroring `domain.adapter.*` on the domain side.

**Purpose:** Encapsulate all Electrobun webview rendering, event wiring, and lifecycle management behind a hook-based API.

**FSD segments:** `api/` (the hook export), `lib/` (constants, preload script strings). No `model/` or `ui/` segments — the hook manages DOM imperatively, not via components.

**Exports:**
- `useElectrobunWebview(props)` — SolidJS hook that:
  - Creates and manages `<electrobun-webview>` elements internally
  - Handles preload scripts, mask selectors, `syncDimensions`
  - Manages a pool of webview instances per session (show/hide, not destroy/recreate)
  - Returns `{ ref, loadUrl, goBack, goForward }`

**Props (typed contract):**
```typescript
// Plain TypeScript type — this is a UI hook contract, not a domain type,
// so Effect Schema is not required here.
type WebviewHookProps = {
  readonly sessionId: string;
  readonly url: string;
  readonly onNavigate: (url: string) => void;
  readonly onTitleChange: (title: string) => void;
  readonly onDomReady: () => void;
  readonly maskSelectors?: readonly string[];
};
```

**Dependency rules:**
| | |
|---|---|
| Can import | `core.shared`, external (`electrobun`). `core.ui` only if specific utilities are needed (e.g., shared tokens); otherwise no dependency. |
| Imported by | `ui.scenes` only (composition root for UI) |
| Never imported by | `ui.feature.*`, `domain.*`, `core.*` |

The hook is called in `ui.scenes`. Results (ref, control methods) are passed as props to `ui.feature.*` components.

### 4.2 No `WebviewPort` Needed

The webview adapter communicates with the domain layer purely through existing RPCs. No push-based port in `core.shared` is needed. The flow is:

1. `useElectrobunWebview` hook captures webview DOM events
2. Calls `props.onNavigate(url)` / `props.onTitleChange(title)` callbacks
3. `ui.scenes` handler calls `BrowsingRpcs.reportNavigation` / `BrowsingRpcs.updateTitle`
4. Domain service handles it via existing request-response RPC pattern

This avoids polluting `core.shared` with a UI-specific port and stays consistent with the existing RPC-based architecture.

### 4.3 Updated Dependency Matrix

The UI tier ordering becomes `a → f → s` (alphabetical = dependency direction), mirroring the domain's `a → f → s`.

```
ui.adapter.*   → core.shared + core.ui + external
ui.feature.*   → domain.service.* + core.ui + core.shared (unchanged)
ui.scenes      → ui.feature.* + ui.adapter.* + core.ui
```

New GritQL rules needed:
- `ui.adapter.*` may only import `core.shared`, `core.ui`, and external packages
- `ui.feature.*` may NOT import `ui.adapter.*`
- `ui.scenes` may import `ui.adapter.*`

### 4.4 Event Flow: Webview Navigation → Session Update

```
<electrobun-webview> fires "did-navigate" / "did-navigate-in-page"
  → useElectrobunWebview hook captures DOM event
    → calls props.onNavigate(url)
      → ui.scenes handler calls BrowsingRpcs.reportNavigation({ id, url })
        → domain.service.browsing handler calls sessions.updateUrl(id, url)
          → SessionRepository.updatePageUrl persists new URL
            → PubSub notifies → Stream emits → UI re-renders
```

Title updates follow the same path:
```
<electrobun-webview> fires "dom-ready"
  → hook extracts document.title via executeJavascript("document.title")
    → calls props.onTitleChange(title)
      → ui.scenes handler calls BrowsingRpcs.updateTitle({ id, title })
        → persists via SessionRepository.updatePageTitle
```

Note: Electrobun may not fire a dedicated `page-title-updated` event. Title extraction happens on `dom-ready` via `executeJavascript`. If a dedicated title event is available, prefer that. This needs verification during implementation.

### 4.5 Session Switching Without Destruction

The `useElectrobunWebview` hook maintains an internal map of `sessionId → webview element`. On session switch:

1. Current webview is hidden (offscreen or `toggleHidden`)
2. Target webview is shown (or created if first visit)
3. No navigation reload — page state is preserved

This map lives inside the hook. The consumer only sees the current session's `ref`.

**Pool size limit:** `MAX_LIVE_WEBVIEWS = 10` (constant in `lib/`). When exceeded, the least recently used inactive webview is destroyed. On next switch to that session, a fresh webview is created and navigated to the session's current URL.

### 4.6 Mask Selector Management

Currently `AppShellTemplate.tsx` manages `[data-omnibox]` mask selectors and `syncDimensions` calls for the webview. After extraction:

- The `useElectrobunWebview` hook owns all mask management internally
- The hook accepts an optional `maskSelectors: string[]` prop for dynamic masks (e.g., when OmniBox overlay opens)
- `syncDimensions` is called internally when masks change
- The scene coordinates mask changes by updating the prop when OmniBox opens/closes

## 5. Sidebar Changes

### 5.1 Remove Bookmarks/History Tabs

In `SidebarFeature.tsx`, remove the "bookmarks" and "history" tab definitions from the rail. Only the "sessions" tab (hamburger icon) remains.

Also rename `onNewTab` → `onNewSession` in `SidebarProps` and `AppShellTemplate` while touching these files.

### 5.2 Omnibox Input in Header

Replace the "SESSIONS" text in the sidebar header with an input field:

- **Layout:** `[hamburger] [url/search input] [+]`
- **Default state:** Shows current page URL or title (truncated)
- **Focused state:** Opens OmniBox dropdown as an overlay anchored to the input, floating over the sidebar panel and content area. The dropdown uses the existing `buildOmniBoxSuggestions` logic.
- **On submit:** Navigates active session via `client.navigate(id, input)`
- **On blur/escape:** Reverts to showing current URL, closes dropdown

The OmniBox dropdown renders as a positioned overlay (not inline within the sidebar), similar to Arc/Zen browser address bars. This requires the webview mask selector to include the dropdown area while open.

## 6. Title/URL Tracking Fix

### 6.1 New RPC: `reportNavigation`

Add to `BrowsingRpcs`:
```typescript
Rpc.make("reportNavigation", {
  payload: { id: Schema.String, url: Schema.String },
  success: SessionSchema,
  error: Schema.Union(DatabaseError, ValidationError),
})
```

**Semantic difference from `navigate`:**
- `navigate` = user-initiated from omnibox. Resolves input, **pushes a new page** onto the session stack, clears forward history, records in history.
- `reportNavigation` = webview-reported. The webview itself navigated (link click, redirect, JS navigation). **Updates the current page's URL in-place**, records in history. Does NOT push a new page onto the stack.

**In-page navigation (`did-navigate-in-page`):** Hash changes and `pushState` navigations are treated the same as `did-navigate` — they call `reportNavigation` which updates the current page URL. This is a simplification; real browser-style history stack tracking within a session page is deferred to the multi-window/tile manager spec.

Handler implementation (goes through the feature layer, not repository directly):
1. Call `sessions.updateUrl(id, url)` — feature method that reads `currentIndex`, calls `SessionRepository.updatePageUrl(id, currentIndex, url)`, and triggers PubSub notification
2. Record in history via `history.record(url, null, null)`

**`SessionFeature.updateUrl` semantics:**
- Reads the session's `currentIndex`
- Calls `SessionRepository.updatePageUrl(id, currentIndex, url)` to update the current page's URL in-place
- Does NOT push a new page onto the stack (unlike `navigate`)
- Triggers PubSub notification

**`SessionRepository.updatePageUrl` port signature** (to add to `core.shared/src/model/ports.ts`):
```typescript
readonly updatePageUrl: (
  sessionId: string,
  pageIndex: number,
  url: string,
) => Effect.Effect<void, DatabaseError>;
```

### 6.2 Existing RPC: `updateTitle`

Already exists. Will now be called from the webview adapter when title is extracted after `dom-ready`.

### 6.3 Electrobun Webview Events to Listen

Per the Electrobun webview tag API:
- `did-navigate` — full page navigation, event detail contains URL
- `did-navigate-in-page` — hash/pushState navigation, event detail contains URL
- `dom-ready` — page loaded, safe to extract title via `executeJavascript("document.title")`

The `useElectrobunWebview` hook listens for these DOM events and calls the corresponding props callbacks. Errors from `executeJavascript("document.title")` are caught internally by the hook — on failure, the title update is skipped (falls back to URL hostname as display title).

## 7. App Icon

### 7.1 Assets Directory

Create `packages/apps/desktop/assets/` with `icon.icns` (provided by user).

### 7.2 Electrobun Config

Update `electrobun.config.ts`:
```typescript
mac: {
  defaultRenderer: "native",
  icon: "assets/icon.icns",
},
```

### 7.3 Build Copy

Add to `build.copy`:
```typescript
"assets/icon.icns": "assets/icon.icns",
```

## 8. Files Changed

### New
- `packages/libs/ui.adapter.electrobun/` — new package with `useElectrobunWebview` hook
- `packages/apps/desktop/assets/icon.icns` — macOS app icon (user-provided)

### Modified
- `packages/libs/core.shared/src/model/ports.ts` — add `updatePageUrl` to `SessionRepository` port (see Section 6.1 for signature)
- `packages/libs/core.ui/src/components/templates/AppShellTemplate/ui/AppShellTemplate.tsx` — remove `<electrobun-webview>` tag, use content slot (`props.children`), rename `onNewTab` → `onNewSession`
- `packages/libs/core.ui/src/components/organisms/Sidebar/ui/Sidebar.tsx` — header omnibox input, remove bookmarks/history tab definitions
- `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx` — remove bookmarks/history tabs, wire omnibox input in header, rename `onNewTab` → `onNewSession`
- `packages/libs/ui.feature.sidebar/src/model/sidebar.bindings.ts` — update bindings for header input
- `packages/libs/domain.service.browsing/src/api/browsing.rpc.ts` — add `reportNavigation` RPC
- `packages/libs/domain.service.browsing/src/api/browsing.handlers.ts` — implement `reportNavigation` handler
- `packages/libs/domain.adapter.db/src/api/session.repository.ts` — add `updatePageUrl` method
- `packages/libs/domain.feature.session/src/api/session.feature.ts` — add `updateUrl` method
- `packages/libs/ui.scenes/` — wire `useElectrobunWebview`, pass props and callbacks to features
- `packages/apps/desktop/electrobun.config.ts` — add icon config and build copy
- `docs/architecture/package-naming.md` — document `ui.adapter.*` tier, update UI tier ordering to `a → f → s`
- `docs/architecture/dependency-matrix.md` — add `ui.adapter.*` rules
- `docs/architecture/fsd-segments.md` — add `ui.adapter.*` segment definitions, fix stale `TAB_FEATURE` reference to `SESSION_FEATURE`

### Removed
- Preload script / mask logic from `AppShellTemplate.tsx` (moves to `ui.adapter.electrobun`)

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Electrobun webview tag event API undocumented/unstable | Verify events fire correctly in dev before committing to the pattern |
| Webview pool memory usage (one per session) | `MAX_LIVE_WEBVIEWS = 10` constant, LRU eviction of inactive views |
| Omnibox in narrow sidebar header may feel cramped | Design in Pencil first, validate layout before implementing |
| Title extraction via `executeJavascript` may fail in some contexts | Fallback to URL hostname as display title if extraction fails |
| `did-navigate-in-page` simplification loses pushState history | Acceptable for now; full history stack deferred to tile manager spec |
