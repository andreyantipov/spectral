# Shadow DOM Webview Persistence — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistent tab state across tab switches using shadow DOM slot pattern (no freezing, no destroying webviews).

**Architecture:** All `<electrobun-webview>` elements live in the light DOM as children of a shadow host. A shadow DOM renders `<slot>` elements — only the active tab's slot has `display: block`. Light DOM children are `display: none` by default, overridden to `display: block !important` via `::slotted(*)` in the shadow DOM. This keeps native WKWebViews alive without freezing (`toggleHidden`) or destroying (DOM removal).

**Tech Stack:** SolidJS, Electrobun `<electrobun-webview>`, Shadow DOM (native web API), Panda CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `ui.adapter.electrobun/src/api/webview-pool.ts` | **Delete** | No longer needed — each session owns its webview |
| `ui.adapter.electrobun/src/api/use-electrobun-webview.ts` | **Delete** | Replaced by per-session `SessionWebview` component |
| `ui.adapter.electrobun/src/index.ts` | **Modify** | Remove old exports, add new ones |
| `ui.adapter.electrobun/src/api/SessionWebview.tsx` | **Create** | Per-session component: URL bar + `<electrobun-webview>` + event wiring |
| `ui.adapter.electrobun/src/api/ShadowContentHost.tsx` | **Create** | Shadow DOM host + `<slot>` manager |
| `ui.adapter.electrobun/src/api/session-webview.style.ts` | **Create** | Panda CSS for URL bar, webview container |
| `ui.scenes/src/ui/MainScene.tsx` | **Rewrite** | Use `ShadowContentHost` + `SessionWebview` per session |
| `ui.feature.sidebar/src/ui/SidebarFeature.tsx` | **Simplify** | Remove `setNavigateFn` hack, expose sessions list |

## Architecture Diagram

```
Light DOM                          Shadow DOM
────────────────────────────────   ──────────────────────────────
AppShellTemplate
  Sidebar
  #content-host (shadow host)      ShadowContent
    SessionWebview[slot="s-{id}"]    <slot name="s-{activeId}">
      div.session-url-bar              ↑ only active slot visible
      electrobun-webview               via display:block/none
    SessionWebview[slot="s-{id}"]
      div.session-url-bar
      electrobun-webview
    ...
```

**CSS trick:**
```css
/* Light DOM: hide all session webviews by default */
#content-host > [data-session-content] { display: none; }

/* Shadow DOM: slotted content becomes visible */
::slotted(*) { display: block !important; }
```

**Tab switch flow:**
1. User clicks tab → `client.setActive({ id })` → state updates
2. `activeSessionId()` signal changes
3. Shadow DOM re-renders: only new active session's slot wrapper gets `display: block`
4. Light DOM `SessionWebview` was never removed — webview stays alive with full page state

---

### Task 1: Create `ShadowContentHost` component

**Files:**
- Create: `packages/libs/ui.adapter.electrobun/src/api/ShadowContentHost.tsx`

This is the shadow DOM host that manages slot visibility.

- [ ] **Step 1: Create the shadow host component**

```tsx
// ShadowContentHost.tsx
import { createEffect, For, type JSX, onMount } from "solid-js";
import { render } from "solid-js/web";

type ShadowContentHostProps = {
  sessionIds: () => string[];
  activeSessionId: () => string;
  children: JSX.Element;
};

export function ShadowContentHost(props: ShadowContentHostProps) {
  let hostEl: HTMLDivElement | undefined;

  onMount(() => {
    if (!hostEl) return;
    const shadow = hostEl.attachShadow({ mode: "open" });

    render(() => (
      <>
        <style>{`
          :host { display: flex; flex: 1; position: relative; overflow: hidden; }
          ::slotted(*) { display: block !important; }
          .slot-wrapper { position: absolute; inset: 0; }
        `}</style>
        <For each={props.sessionIds()}>
          {(id) => (
            <div
              class="slot-wrapper"
              style={{
                display: id === props.activeSessionId() ? "block" : "none",
                "pointer-events": id === props.activeSessionId() ? "auto" : "none",
              }}
            >
              <slot name={`session-${id}`} />
            </div>
          )}
        </For>
      </>
    ), shadow);
  });

  return (
    <div
      ref={hostEl}
      id="content-host"
      style="display: flex; flex: 1; width: 100%; height: 100%;"
    >
      {props.children}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run build --force`

- [ ] **Step 3: Commit**

```
feat: add ShadowContentHost for persistent webview tabs
```

---

### Task 2: Create `SessionWebview` component

**Files:**
- Create: `packages/libs/ui.adapter.electrobun/src/api/SessionWebview.tsx`
- Create: `packages/libs/ui.adapter.electrobun/src/api/session-webview.style.ts`

Each session gets its own webview + URL bar. The component is a light DOM child that slots into the shadow DOM.

- [ ] **Step 1: Create the style file**

```ts
// session-webview.style.ts
import { sva } from "@styled-system/css";

export const sessionWebview = sva({
  slots: ["root", "urlBar", "urlBarBtn", "urlInput", "webviewContainer"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      width: "100%",
    },
    urlBar: {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      height: "36px",
      px: "8px",
      flexShrink: 0,
      bg: "bg.primary",
    },
    urlBarBtn: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "28px",
      height: "28px",
      borderRadius: "md",
      fontSize: "14px",
      color: "fg.muted",
      bg: "transparent",
      border: "1px solid transparent",
      cursor: "pointer",
      flexShrink: 0,
      transition: "all 0.15s ease",
      _hover: {
        bg: "bg.secondary",
        borderColor: "fg.muted",
        color: "fg.primary",
      },
      _disabled: {
        opacity: 0.3,
        cursor: "default",
        _hover: { bg: "transparent", borderColor: "transparent", color: "fg.muted" },
      },
    },
    urlInput: {
      flex: 1,
      minWidth: 0,
      bg: "bg.secondary",
      border: "1px solid transparent",
      borderRadius: "md",
      color: "fg.secondary",
      fontSize: "12px",
      fontFamily: "body",
      padding: "5px 10px",
      outline: "none",
      transition: "all 0.15s ease",
      _hover: { borderColor: "fg.muted" },
      _focus: { borderColor: "accent", color: "fg.primary" },
    },
    webviewContainer: {
      flex: 1,
      position: "relative",
      overflow: "hidden",
    },
  },
});
```

- [ ] **Step 2: Create the component**

```tsx
// SessionWebview.tsx
import { createSignal, onCleanup, Show } from "solid-js";
import { SHORTCUT_PRELOAD } from "../lib/constants";
import type { WebviewTagElement } from "../lib/types";
import { sessionWebview } from "./session-webview.style";

export type SessionWebviewProps = {
  sessionId: string;
  url: string;
  onNavigate: (url: string) => void;
  onTitleChange: (title: string) => void;
};

export function SessionWebview(props: SessionWebviewProps) {
  const $ = sessionWebview;
  let webviewRef: WebviewTagElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  const [displayUrl, setDisplayUrl] = createSignal(props.url);
  const [canGoBack, setCanGoBack] = createSignal(false);
  const [canGoForward, setCanGoForward] = createSignal(false);

  const isBlank = () => !props.url || props.url === "about:blank";

  function createWebview(url: string) {
    if (!containerRef || webviewRef) return;
    const el = document.createElement("electrobun-webview") as unknown as WebviewTagElement;
    const htmlEl = el as unknown as HTMLElement;
    htmlEl.setAttribute("preload", SHORTCUT_PRELOAD);
    htmlEl.setAttribute("src", url);
    htmlEl.style.cssText = "width: 100%; height: 100%; position: absolute; inset: 0; background: #0a0a0a;";
    containerRef.appendChild(htmlEl);
    el.addMaskSelector("[data-omnibox]");

    el.on("did-navigate", (event: CustomEvent) => {
      const navUrl = (event as CustomEvent<string>).detail;
      if (navUrl && navUrl !== "about:blank") {
        setDisplayUrl(navUrl);
        props.onNavigate(navUrl);
      }
    });
    el.on("did-navigate-in-page", (event: CustomEvent) => {
      const navUrl = (event as CustomEvent<string>).detail;
      if (navUrl && navUrl !== "about:blank") {
        setDisplayUrl(navUrl);
        props.onNavigate(navUrl);
      }
    });
    el.on("dom-ready", () => {
      el.executeJavascript("document.title")
        .then((title) => {
          if (typeof title === "string" && title.length > 0) {
            props.onTitleChange(title);
          }
        })
        .catch(() => {});
      // Update nav button state
      setCanGoBack(el.canGoBack());
      setCanGoForward(el.canGoForward());
    });
    el.on("host-message", (event: CustomEvent) => {
      document.dispatchEvent(new CustomEvent("webview-host-message", { detail: event.detail }));
    });

    webviewRef = el;
  }

  function handleUrlKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      const input = (e.target as HTMLInputElement).value.trim();
      if (!input) return;
      const url = input.match(/^https?:\/\//) ? input : `https://${input}`;
      navigate(url);
    }
  }

  function navigate(url: string) {
    if (!webviewRef) {
      createWebview(url);
    } else {
      webviewRef.loadURL(url);
    }
    setDisplayUrl(url);
  }

  // Create webview when URL is set (not blank)
  // Defer to allow DOM to settle
  requestAnimationFrame(() => {
    if (!isBlank()) createWebview(props.url);
  });

  onCleanup(() => {
    if (webviewRef) {
      (webviewRef as unknown as HTMLElement).remove();
      webviewRef = undefined;
    }
  });

  return (
    <div
      data-session-content
      slot={`session-${props.sessionId}`}
      style={{ width: "100%", height: "100%", display: "flex", "flex-direction": "column" }}
    >
      <Show when={!isBlank()}>
        <div class={$().urlBar}>
          <button
            type="button"
            class={$().urlBarBtn}
            disabled={!canGoBack()}
            onClick={() => webviewRef?.goBack()}
          >
            ←
          </button>
          <button
            type="button"
            class={$().urlBarBtn}
            disabled={!canGoForward()}
            onClick={() => webviewRef?.goForward()}
          >
            →
          </button>
          <button
            type="button"
            class={$().urlBarBtn}
            onClick={() => webviewRef?.reload()}
          >
            ↻
          </button>
          <input
            type="text"
            class={$().urlInput}
            value={displayUrl()}
            onKeyDown={handleUrlKeyDown}
          />
        </div>
      </Show>
      <div ref={(el) => { containerRef = el; }} class={$().webviewContainer}>
        <Show when={isBlank()}>
          <div style="position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center;">
            {/* BlankPage will be rendered here by the scene */}
          </div>
        </Show>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `bun run build --force`

- [ ] **Step 4: Commit**

```
feat: add SessionWebview with per-tab URL bar and webview
```

---

### Task 3: Rewrite `MainScene` to use shadow DOM pattern

**Files:**
- Modify: `packages/libs/ui.scenes/src/ui/MainScene.tsx`
- Modify: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx`

- [ ] **Step 1: Update SidebarFeature to expose sessions list**

Add `sessions` and `activeSessionId` to `WebviewBindings`:

```tsx
export type WebviewBindings = {
  readonly sessions: () => readonly Session[];
  readonly activeSessionId: () => string;
  readonly activeUrl: () => string | undefined;
  readonly onNavigate: (url: string) => void;
  readonly onTitleChange: (title: string) => void;
};
```

Remove `setNavigateFn` — no longer needed. Add `sessions` to the bindings object:

```tsx
const webviewBindings: WebviewBindings = {
  sessions: () => state()?.sessions ?? [],
  activeSessionId: () => activeSession()?.id ?? "",
  activeUrl,
  onNavigate: ops.reportNavigation,
  onTitleChange: ops.updateTitle,
};
```

- [ ] **Step 2: Rewrite MainScene**

```tsx
import { currentUrl } from "@ctrl/core.shared";
import { BlankPage } from "@ctrl/core.ui";
import { SessionWebview, ShadowContentHost } from "@ctrl/ui.adapter.electrobun";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import { For, Show } from "solid-js";

export function MainScene() {
  return (
    <SidebarFeature>
      {(bindings: WebviewBindings) => (
        <ShadowContentHost
          sessionIds={() => bindings.sessions().map((s) => s.id)}
          activeSessionId={bindings.activeSessionId}
        >
          <For each={bindings.sessions()}>
            {(session) => (
              <SessionWebview
                sessionId={session.id}
                url={currentUrl(session) ?? "about:blank"}
                onNavigate={bindings.onNavigate}
                onTitleChange={bindings.onTitleChange}
              />
            )}
          </For>
        </ShadowContentHost>
      )}
    </SidebarFeature>
  );
}
```

- [ ] **Step 3: Update exports**

Update `ui.adapter.electrobun/src/index.ts`:
```ts
export { SessionWebview } from "./api/SessionWebview";
export { ShadowContentHost } from "./api/ShadowContentHost";
export type { SessionWebviewProps } from "./api/SessionWebview";
```

- [ ] **Step 4: Add light DOM CSS rule**

Add to the app's global CSS or as a `<style>` in the AppShellTemplate:
```css
#content-host > [data-session-content] { display: none; }
```

- [ ] **Step 5: Verify build + manual test**

Run: `bun run build --force`
Test: Open app, create two tabs, navigate both, switch between them — page state should persist.

- [ ] **Step 6: Commit**

```
feat: shadow DOM webview persistence — tabs survive switching
```

---

### Task 4: Clean up old webview pool code

**Files:**
- Delete: `packages/libs/ui.adapter.electrobun/src/api/webview-pool.ts`
- Delete: `packages/libs/ui.adapter.electrobun/src/api/use-electrobun-webview.ts`
- Modify: `packages/libs/ui.adapter.electrobun/src/lib/constants.ts` — keep `SHORTCUT_PRELOAD`, remove `MAX_LIVE_WEBVIEWS`
- Modify: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx` — remove `setNavigateFn`, `navigateActiveSession` direct-nav pattern

- [ ] **Step 1: Delete pool files**
- [ ] **Step 2: Remove `MAX_LIVE_WEBVIEWS` constant**
- [ ] **Step 3: Simplify SidebarFeature navigate flow**

The `navigateActiveSession` function currently calls `webviewNavigate?.(url)` after RPC. With per-session webviews, navigation is driven reactively by the session's URL in state. Remove the `webviewNavigate` hack entirely:

```tsx
const ops = withWebTracing(SIDEBAR_FEATURE, {
  navigate: (input: string) => {
    const session = activeSession();
    if (session) {
      void runtime.runPromise(client.navigate({ id: session.id, input }));
      // No more webviewNavigate — SessionWebview reacts to URL change in state
    }
  },
  // ... rest unchanged
});
```

- [ ] **Step 4: Verify build + tests**

Run: `bun run build --force && bun run test`

- [ ] **Step 5: Commit**

```
refactor: remove webview pool — replaced by shadow DOM persistence
```

---

### Task 5: Wire OmniBox through shadow DOM

**Files:**
- Modify: `packages/libs/core.ui/src/components/templates/AppShellTemplate/ui/AppShellTemplate.tsx`

The OmniBox currently renders as an absolute overlay that needs mask selectors. With the shadow DOM pattern, the OmniBox can render OUTSIDE the shadow host (in normal DOM flow) so it naturally sits above the content. The mask selector `[data-omnibox]` still works for cutting holes in native views.

- [ ] **Step 1: Verify OmniBox mask still works**

The existing `addMaskSelector("[data-omnibox]")` in `SessionWebview` should still cut holes. After the shadow DOM change, verify the OmniBox appears correctly above webviews.

- [ ] **Step 2: If mask breaks, add syncDimensions call**

The `createEffect` in AppShellTemplate that syncs dimensions on omnibox open/close should still work since it queries all `electrobun-webview` elements globally.

- [ ] **Step 3: Commit if changes needed**

```
fix: ensure OmniBox mask works with shadow DOM webviews
```

---

## Verification Checklist

- [ ] Two tabs open, switch between them — page state (scroll, forms, video playback) preserved
- [ ] New blank tab shows BlankPage component, previous webview hidden
- [ ] Per-tab URL bar shows correct URL, back/forward buttons work
- [ ] OmniBox (Cmd+L) renders above webviews correctly
- [ ] OTEL traces still flowing (check `/tmp/ctrl-page-telemetry.jsonl`)
- [ ] `bun run build --force` — passes
- [ ] `bun run test` — passes
- [ ] `bunx grit check packages/libs/` — no new violations
