# Electrobun Webview Tag

## Overview

ctrl.page renders web pages using `<electrobun-webview>` — an HTML custom element that creates an out-of-process iframe (OOPIF). Unlike `BrowserView` (which creates a native OS-level view on top of the DOM), the webview tag lives in the DOM tree and supports standard CSS (z-index, positioning, flex layout).

This means overlays like CommandCenter render on top of web content naturally.

## Usage in SolidJS

Since `electrobun-webview` is a custom element, use SolidJS `Dynamic` to render it:

```tsx
import { Dynamic } from "solid-js/web";

<Dynamic
  component="electrobun-webview"
  ref={(el: HTMLElement) => { webviewRef = el; }}
  src="https://example.com"
  sandbox=""
  style="width: 100%; height: 100%; display: block;"
/>
```

Navigate programmatically via ref:

```tsx
createEffect(() => {
  const url = currentUrl();
  if (webviewRef && url && url !== "about:blank") {
    (webviewRef as unknown as { loadURL: (url: string) => void }).loadURL(url);
  }
});
```

## Key Attributes

| Attribute | Description |
|-----------|-------------|
| `src` | Initial URL to load |
| `html` | HTML string to load (alternative to src) |
| `sandbox` | Disables RPC, events only — use for untrusted/external content |
| `preload` | Script to run before page scripts |
| `partition` | Session isolation (prefix `persist:` for persistence) |
| `renderer` | `"native"` (default on macOS) or `"cef"` |
| `transparent` | Makes the webview background transparent |
| `passthrough` | Passes mouse/keyboard events through to the host |
| `masks` | Comma-separated CSS selectors for mask regions |

## API Methods (via ref)

### Navigation
- `loadURL(url)` — navigate to URL
- `loadHTML(html)` — load HTML string
- `reload()` — reload current page
- `goBack()` / `goForward()` — history navigation
- `canGoBack()` / `canGoForward()` — returns `Promise<boolean>`

### Visibility
- `toggleHidden(hidden?)` — show/hide the webview
- `toggleTransparent(transparent?)` — toggle opacity (CSS opacity + native)
- `togglePassthrough(passthrough?)` — toggle pointer-events pass-through

### Mask Selectors
Masks define DOM elements that should "cut through" the webview, allowing click-through to the host page:

```tsx
// CommandCenter overlay should receive clicks even over the webview
webviewRef.addMaskSelector('.commandCenterOverlay');
webviewRef.removeMaskSelector('.commandCenterOverlay');
```

### Find in Page
- `findInPage(text, { forward?, matchCase? })` — search and highlight
- `stopFindInPage()` — clear search

### DevTools
- `openDevTools()` / `closeDevTools()` / `toggleDevTools()`

### Navigation Rules
```tsx
webviewRef.setNavigationRules([
  "^*.malware.com",  // block
  "*.example.com",   // allow
]);
```
Rules use glob patterns. `^` prefix blocks. Last matching rule wins.

## Events

Listen via the `on`/`off` methods on the ref:

```tsx
webviewRef.on("did-navigate", (e: CustomEvent) => {
  console.log("Navigated to:", e.detail);
});
```

| Event | Detail |
|-------|--------|
| `did-navigate` | URL |
| `did-navigate-in-page` | URL (hash/pushState navigation) |
| `did-commit-navigation` | URL (frame started receiving content) |
| `dom-ready` | — |
| `will-navigate` | `{ url, allowed }` |
| `new-window-open` | `{ url, isCmdClick, ... }` |
| `download-started` | `{ filename, path }` |
| `download-progress` | `{ progress: 0-100 }` |
| `download-completed` | `{ filename, path }` |
| `download-failed` | `{ filename, path, error }` |

## Architecture Notes

- The webview tag creates a native OOPIF under the hood — web content runs in a separate process
- Position syncing is automatic via `OverlaySyncController` (ResizeObserver + polling)
- The element uses `getBoundingClientRect()` to sync its DOM position with the native view
- Default size is 800x300 — always set explicit CSS dimensions
- `sandbox` attribute is read-only after creation

## Why Not BrowserView?

`BrowserView` creates a native OS-level view that renders on top of the webview DOM. This makes it impossible to render DOM overlays (like CommandCenter) on top of web content. The webview tag is a DOM element, so standard CSS z-index works.

| | BrowserView | `<electrobun-webview>` |
|---|---|---|
| Created from | Bun process | DOM (webview) |
| Rendering layer | Native (above DOM) | DOM element |
| CSS z-index | No | Yes |
| Overlays on top | Impossible | Natural |
| Focus/keyboard | Captures exclusively | Standard DOM |
| Use case | Standalone windows | Embedded content |
