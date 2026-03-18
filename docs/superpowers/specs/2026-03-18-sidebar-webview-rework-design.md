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

**Exports:**
- `useElectrobunWebview(props)` — SolidJS hook that:
  - Creates and manages `<electrobun-webview>` elements internally
  - Handles preload scripts, mask selectors, `syncDimensions`
  - Manages a pool of webview instances per session (show/hide, not destroy/recreate)
  - Returns `{ ref, loadUrl, goBack, goForward }`

**Props (typed contract):**
```typescript
type WebviewHookProps = {
  readonly sessionId: string;
  readonly url: string;
  readonly onNavigate: (url: string) => void;
  readonly onTitleChange: (title: string) => void;
  readonly onDomReady: () => void;
};
```

**Dependency rules:**
| | |
|---|---|
| Can import | `core.shared`, `core.ui`, external (`electrobun`) |
| Imported by | `ui.scenes` only (composition root for UI) |
| Never imported by | `ui.feature.*`, `domain.*`, `core.*` |

The hook is called in `ui.scenes`. Results (ref, control methods) are passed as props to `ui.feature.*` components.

### 4.2 Port: `WebviewPort` in `core.shared`

A `Context.Tag` in `core.shared/model/ports.ts` defining the webview event/control contract:

```typescript
export class WebviewPort extends Context.Tag("WebviewPort")<
  WebviewPort,
  {
    readonly onNavigate: (handler: (sessionId: string, url: string) => void) => () => void;
    readonly onTitleChange: (handler: (sessionId: string, title: string) => void) => () => void;
  }
>() {}
```

This port is consumed by `domain.service.browsing` to subscribe to webview navigation events and update session state. The `ui.adapter.electrobun` hook provides the implementation, wired at the composition root (`apps/desktop`).

### 4.3 Updated Dependency Matrix

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
  → useElectrobunWebview hook captures event
    → calls props.onNavigate(url) and props.onTitleChange(title)
      → ui.scenes handler calls BrowsingRpcs.reportNavigation / updateTitle
        → domain.service.browsing handler updates session via SessionFeature
          → SessionRepository persists new URL/title
            → PubSub notifies → Stream emits → UI re-renders
```

### 4.5 Session Switching Without Destruction

The `useElectrobunWebview` hook maintains an internal map of `sessionId → webview element`. On session switch:

1. Current webview is hidden (offscreen or `toggleHidden`)
2. Target webview is shown (or created if first visit)
3. No navigation reload — page state is preserved

This map lives inside the hook. The consumer only sees the current session's `ref`.

## 5. Sidebar Changes

### 5.1 Remove Bookmarks/History Tabs

In `SidebarFeature.tsx`, remove the "bookmarks" and "history" tab definitions from the rail. Only the "sessions" tab (hamburger icon) remains.

### 5.2 Omnibox Input in Header

Replace the "SESSIONS" text in the sidebar header with an input field:

- **Layout:** `[hamburger] [url/search input] [+]`
- **Default state:** Shows current page URL or title (truncated)
- **Focused state:** Opens OmniBox dropdown with suggestions (reuses existing `buildOmniBoxSuggestions` logic)
- **On submit:** Navigates active session via `client.navigate(id, input)`
- **On blur/escape:** Reverts to showing current URL

This reuses the existing `OmniBox` component — it's relocated from wherever it currently appears into the sidebar header.

## 6. Title/URL Tracking Fix

### 6.1 New RPC: `reportNavigation`

Add to `BrowsingRpcs`:
```typescript
reportNavigation: Rpc.make({
  input: Schema.Struct({ id: Schema.String, url: Schema.String }),
  output: Schema.Void,
})
```

Handler implementation:
1. Update the current page's URL in the session (new `SessionRepository.updatePageUrl` method)
2. Record in history
3. Notify via PubSub

### 6.2 Existing RPC: `updateTitle`

Already exists. Will now be called from the webview adapter when `<electrobun-webview>` fires title change events.

### 6.3 Electrobun Webview Events to Listen

Per the Electrobun API (`BrowserView.on()`):
- `did-navigate` — full page navigation (new URL)
- `did-navigate-in-page` — hash/pushState navigation (URL change without reload)
- `dom-ready` — page loaded, safe to extract title

The `<electrobun-webview>` custom element fires these as DOM events. The `useElectrobunWebview` hook listens for them and calls the corresponding props.

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
- `packages/libs/core.shared/src/model/ports.ts` — add `WebviewPort`
- `packages/libs/core.ui/src/components/templates/AppShellTemplate/ui/AppShellTemplate.tsx` — remove `<electrobun-webview>` tag, use content slot
- `packages/libs/core.ui/src/components/organisms/Sidebar/ui/Sidebar.tsx` — header input, remove tab definitions
- `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx` — remove bookmarks/history tabs, wire omnibox input in header
- `packages/libs/ui.feature.sidebar/src/model/sidebar.bindings.ts` — update bindings for header input
- `packages/libs/domain.service.browsing/src/api/browsing.rpc.ts` — add `reportNavigation` RPC
- `packages/libs/domain.service.browsing/src/api/browsing.handlers.ts` — implement `reportNavigation`, subscribe to `WebviewPort`
- `packages/libs/domain.adapter.db/src/api/session.repository.ts` — add `updatePageUrl` method
- `packages/libs/domain.feature.session/src/api/session.feature.ts` — add `updateUrl` method
- `packages/libs/ui.scenes/` — wire `useElectrobunWebview`, pass props to features
- `packages/apps/desktop/electrobun.config.ts` — add icon config
- `docs/architecture/package-naming.md` — document `ui.adapter.*` tier
- `docs/architecture/dependency-matrix.md` — add `ui.adapter.*` rules

### Removed
- Preload script / mask logic from `AppShellTemplate.tsx` (moves to `ui.adapter.electrobun`)

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Electrobun webview tag event API undocumented/unstable | Verify events fire correctly in dev before committing to the pattern |
| Webview pool memory usage (one per session) | Limit pool size, destroy oldest inactive webviews if threshold exceeded |
| Omnibox in narrow sidebar header may feel cramped | Design in Pencil first, validate layout before implementing |
