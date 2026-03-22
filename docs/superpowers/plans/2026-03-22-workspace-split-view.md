# Workspace Split-View Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable visual split-view where users can drag tabs from sidebar into workspace panes, create empty tabs in workspace, and see webviews properly positioned inside dockview panels.

**Architecture:** Dockview manages the split layout (resize sashes, drop targets). Electrobun webviews render inside dockview panel containers — `getBoundingClientRect()` returns correct viewport positions so `syncDimensions` works. Sidebar tabs are Zen-style with group awareness. Dockview's `abyss-spaced` theme provides rounded corners + gaps, customized via CSS custom properties (no raw dockview CSS, Panda CSS sva for our overrides). Dockview's built-in tab bar is hidden since our sidebar manages tabs.

**Tech Stack:** dockview-core v5, Electrobun (native webviews), SolidJS, Panda CSS (sva), Effect RPC

**Key Insight:** `getBoundingClientRect()` works correctly inside dockview's flexbox panel layout. The previous failure was caused by `position: absolute; inset: 0` on SessionWebview's outer div, which made it ignore the dockview panel bounds. Removing this wrapper lets the webview fill its dockview panel container, and `syncDimensions` positions the native view to the panel's actual viewport rect.

---

## Phase 1: Fix Webview Positioning in Dockview

### Task 1: SessionWebview — remove absolute positioning, fill container

**Files:**
- Modify: `packages/libs/ui.adapter.electrobun/src/api/SessionWebview.tsx`

The root cause of the previous split-view failure: the outer `<div style="position: absolute; inset: 0">` forces the webview to cover the entire viewport instead of its dockview panel container.

- [ ] **Step 1: Update return JSX**

Replace the current return (lines 105-114):
```tsx
// BEFORE:
<div style="width: 100%; height: 100%; position: absolute; inset: 0;">
  <div ref={...} style="width: 100%; height: 100%; position: relative;" />
</div>

// AFTER:
<div
  ref={(el) => { containerRef = el; }}
  style="width: 100%; height: 100%; position: relative; overflow: hidden;"
/>
```

Remove the outer absolute-positioned wrapper. The single `<div>` fills its parent (which is the dockview panel's content-container via `createSolidRenderer`).

- [ ] **Step 2: Remove `isActive` gating for `syncDimensions`**

In the isActive effect (lines 86-96), all visible webviews need `syncDimensions` — not just the "active" one. In split-view, multiple webviews are visible simultaneously.

```typescript
createEffect(() => {
  if (!webviewRef) return;
  // In split-view, only the focused pane is "active" but all are visible
  // syncDimensions should always be called to keep native view aligned
  webviewRef.syncDimensions(true);
  if (props.isActive) {
    webviewRef.toggleTransparent(false);
    webviewRef.togglePassthrough(false);
  } else {
    webviewRef.toggleTransparent(false); // Still visible in split-view
    webviewRef.togglePassthrough(true);  // But passthrough for non-focused pane
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/libs/ui.adapter.electrobun/src/api/SessionWebview.tsx
git commit -m "fix: SessionWebview fills container instead of viewport overlay"
```

---

## Phase 2: Dockview Styling via Panda CSS

### Task 2: Workspace sva theme that maps to dockview class names

**Files:**
- Modify: `packages/libs/ui.feature.workspace/src/ui/workspace.style.ts`
- Create: `packages/apps/desktop/src/main-ui/dockview-overrides.css`

Dockview provides the `dockview-theme-abyss-spaced` theme with rounded corners and gaps. We override its CSS custom properties with our colors and hide the tab bar.

- [ ] **Step 1: Update workspace sva**

```typescript
// workspace.style.ts
import { sva } from "@styled-system/css";

export const workspace = sva({
  slots: ["root", "pane", "sash", "dropTarget", "emptyPane"],
  base: {
    root: {
      display: "flex",
      flex: 1,
      height: "100%",
      overflow: "hidden",
      bg: "#111111",
      // Gap between panes is handled by dockview's abyss-spaced theme
    },
    pane: {
      borderRadius: "10px",
      overflow: "hidden",
      bg: "#1e1e1e",
      width: "100%",
      height: "100%",
    },
    sash: {
      bg: "transparent",
      cursor: "col-resize",
      transition: "background 0.15s ease",
      _hover: { bg: "rgba(255,255,255,0.08)" },
    },
    dropTarget: {
      bg: "rgba(59, 130, 246, 0.15)",
      borderRadius: "10px",
      border: "2px dashed rgba(59, 130, 246, 0.4)",
    },
    emptyPane: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      bg: "#1e1e1e",
      borderRadius: "10px",
      color: "rgba(255,255,255,0.2)",
      fontSize: "14px",
      fontFamily: "Inter, sans-serif",
      cursor: "pointer",
      _hover: { color: "rgba(255,255,255,0.4)" },
    },
  },
});
```

- [ ] **Step 2: Create dockview CSS overrides file**

```css
/* dockview-overrides.css — loaded after dockview.css */
/* Use abyss-spaced as base, override colors for ctrl.page dark theme */
.dv-workspace {
  --dv-background-color: #111111;
  --dv-paneview-header-border-color: transparent;
  --dv-separator-border: transparent;
  --dv-border-radius: 10px;
  --dv-active-sash-color: rgba(255, 255, 255, 0.15);
  --dv-active-sash-transition-delay: 0.2s;
  --dv-active-sash-transition-duration: 0.15s;
  --dv-group-view-background-color: #1e1e1e;
  --dv-tabs-and-actions-container-height: 0px;
}
/* Hide dockview's built-in tab bar — sidebar manages tabs */
.dv-workspace .dv-tabs-and-actions-container {
  display: none !important;
}
/* Pane content fills the group */
.dv-workspace .dv-groupview > .dv-content-container {
  border-radius: 10px;
  overflow: hidden;
}
/* Drop target styling */
.dv-workspace .dv-drop-target-container .dv-drop-target-anchor {
  background: rgba(59, 130, 246, 0.15);
  border: 2px dashed rgba(59, 130, 246, 0.4);
  border-radius: 10px;
}
```

- [ ] **Step 3: Update build-view.ts to include dockview CSS + overrides**

```typescript
// In build-view.ts, after the Bun.build step:
import { readFileSync, writeFileSync } from "node:fs";

const coreStyles = readFileSync("../../libs/core.ui/build/styles.css", "utf8");
const dockviewCss = readFileSync("../../../node_modules/dockview-core/dist/styles/dockview.css", "utf8");
const overrides = readFileSync("src/main-ui/dockview-overrides.css", "utf8");
writeFileSync("build/main-ui/styles.css", `${coreStyles}\n${dockviewCss}\n${overrides}`);
```

- [ ] **Step 4: Commit**

```bash
git add packages/libs/ui.feature.workspace/src/ui/workspace.style.ts packages/apps/desktop/src/main-ui/dockview-overrides.css packages/apps/desktop/build-view.ts
git commit -m "feat: Panda CSS sva workspace theme + dockview abyss-spaced overrides"
```

---

## Phase 3: Wire Dockview into MainScene

### Task 3: MainScene with dockview + SolidJS context for bindings

**Files:**
- Modify: `packages/libs/ui.scenes/src/ui/MainScene.tsx`
- Modify: `packages/libs/ui.scenes/package.json`

- [ ] **Step 1: Add dependencies**

Add `@ctrl/ui.adapter.dockview` back to `ui.scenes/package.json` dependencies.

- [ ] **Step 2: Rewrite MainScene**

Key fixes from the previous attempt:
- Use `onMount` in DockviewProvider (already done) — no reactive loops
- Use SolidJS `createContext` for bindings — stable reference
- `SessionPanel` at module level — stable function reference
- Guard panel sync effect with `initialized` flag
- Use `untrack` in handleReady

```tsx
// MainScene.tsx
import { currentUrl, type Session } from "@ctrl/core.shared";
import { BlankPage } from "@ctrl/core.ui";
import type { PanelProps } from "@ctrl/ui.adapter.dockview";
import { DockviewProvider } from "@ctrl/ui.adapter.dockview";
import { SessionWebview, syncAllWebviewDimensions } from "@ctrl/ui.adapter.electrobun";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import type { DockviewApi } from "dockview-core";
import { createContext, createEffect, createMemo, Show, untrack, useContext } from "solid-js";

const BindingsContext = createContext<WebviewBindings>();

export function MainScene() {
  return (
    <SidebarFeature>
      {(bindings: WebviewBindings) => (
        <BindingsContext.Provider value={bindings}>
          <WorkspaceContent />
        </BindingsContext.Provider>
      )}
    </SidebarFeature>
  );
}

function SessionPanel(panelProps: PanelProps) {
  const bindings = useContext(BindingsContext);
  const sessionId = String(panelProps.params.sessionId ?? "");

  const url = () => {
    const s = bindings?.sessions().find((s) => s.id === sessionId);
    return s ? (currentUrl(s) ?? "about:blank") : "about:blank";
  };

  return (
    <SessionWebview
      sessionId={sessionId}
      url={url()}
      isActive={bindings?.activeSessionId() === sessionId}
      onNavigate={(navUrl) => bindings?.onNavigate(sessionId, navUrl)}
      onTitleChange={(title) => bindings?.onTitleChange(sessionId, title)}
    />
  );
}

const COMPONENTS = { session: SessionPanel };

function WorkspaceContent() {
  const bindings = useContext(BindingsContext)!;
  let api: DockviewApi | undefined;
  let initialized = false;

  const sessionIds = createMemo(
    () => bindings.sessions().map((s) => s.id),
    undefined,
    { equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]) },
  );

  const isActiveBlank = () => {
    const s = bindings.sessions().find((s) => s.id === bindings.activeSessionId());
    if (!s) return true;
    const url = currentUrl(s);
    return !url || url === "about:blank";
  };

  function scheduleSync() {
    requestAnimationFrame(() => syncAllWebviewDimensions());
  }

  // Sync panels when sessions change (after initial load)
  createEffect(() => {
    const ids = sessionIds();
    if (!api || !initialized) return;

    const existing = new Set(api.panels.map((p) => p.id));
    for (const id of ids) {
      if (!existing.has(id)) {
        api.addPanel({ id, component: "session", params: { sessionId: id } });
      }
    }
    for (const panel of [...api.panels]) {
      if (!ids.includes(panel.id)) {
        api.removePanel(panel);
      }
    }
    scheduleSync();
  });

  // Sync active panel
  createEffect(() => {
    const activeId = bindings.activeSessionId();
    if (!api || !activeId) return;
    const panel = api.panels.find((p) => p.id === activeId);
    if (panel && api.activePanel?.id !== activeId) {
      panel.api.setActive();
    }
  });

  function handleReady(dockviewApi: DockviewApi) {
    api = dockviewApi;
    dockviewApi.onDidLayoutChange(() => scheduleSync());

    const ids = untrack(sessionIds);
    for (const id of ids) {
      dockviewApi.addPanel({ id, component: "session", params: { sessionId: id } });
    }

    const activeId = untrack(bindings.activeSessionId);
    if (activeId) {
      const panel = dockviewApi.panels.find((p) => p.id === activeId);
      if (panel) panel.api.setActive();
    }

    scheduleSync();
    initialized = true;
  }

  return (
    <div style="display: flex; flex: 1; width: 100%; height: 100%; position: relative; overflow: hidden;">
      <DockviewProvider
        components={COMPONENTS}
        onReady={handleReady}
        class="dv-workspace"
      />
      <Show when={isActiveBlank()}>
        <div style="position: absolute; inset: 0; z-index: 1;">
          <BlankPage />
        </div>
      </Show>
    </div>
  );
}
```

- [ ] **Step 3: Update DockviewProvider to use abyss-spaced theme**

In `DockviewProvider.tsx`, change the theme class:
```typescript
const cls = () => `dockview-theme-abyss-spaced dv-workspace${props.class ? ` ${props.class}` : ""}`;
```

- [ ] **Step 4: Build, launch, screenshot, verify**

```bash
bun run build --force
nohup bun run dev:desktop:agentic > /tmp/ctrl-page-dev.log 2>&1 &
sleep 8
screencapture /tmp/ctrl-page-split.png
```

Verify: webviews render inside dockview panel boundaries (not overlaying the whole window).

- [ ] **Step 5: Commit**

```bash
git add packages/libs/ui.scenes packages/libs/ui.adapter.dockview
git commit -m "feat: dockview split-view with proper webview positioning"
```

---

## Phase 4: Empty Pane + New Tab in Workspace

### Task 4: EmptyPane component with "+" button to create a tab

**Files:**
- Create: `packages/libs/ui.scenes/src/ui/EmptyPane.tsx`
- Modify: `packages/libs/ui.scenes/src/ui/MainScene.tsx`

When a dockview panel has no session assigned, or user creates an empty split, show a centered "+" button to create a new tab in that pane.

- [ ] **Step 1: Create EmptyPane component**

```tsx
// EmptyPane.tsx
import type { JSX } from "solid-js";

export type EmptyPaneProps = {
  onCreateTab: () => void;
};

export function EmptyPane(props: EmptyPaneProps): JSX.Element {
  return (
    <div
      style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: #1e1e1e; border-radius: 10px; cursor: pointer;"
      onClick={props.onCreateTab}
    >
      <span style="color: rgba(255,255,255,0.2); font-size: 32px; font-family: Inter, sans-serif; transition: color 0.15s ease;">
        +
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Register EmptyPane as dockview component**

In MainScene, add `empty` to COMPONENTS:
```typescript
function EmptyPanelRenderer(panelProps: PanelProps) {
  const bindings = useContext(BindingsContext);
  return (
    <EmptyPane onCreateTab={() => {
      // Create new session and assign to this panel
      bindings?.createSession?.();
    }} />
  );
}

const COMPONENTS = { session: SessionPanel, empty: EmptyPanelRenderer };
```

- [ ] **Step 3: Commit**

---

## Phase 5: Sidebar Tab Group Awareness

### Task 5: Update sidebar to show tabs grouped by workspace pane

**Files:**
- Modify: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx`
- Modify: `packages/libs/ui.feature.sidebar/src/model/sidebar.bindings.ts`

This is a future task — the sidebar currently shows a flat list which works for single-pane. Grouping requires workspace layout state to be exposed to the sidebar (which pane each session belongs to). The domain layer `WorkspaceRpcs` already supports this via `getLayout()` — it needs to be wired into the sidebar's state.

For now, the flat list works correctly with split-view: clicking a tab activates it (which focuses its dockview pane). Closing a tab removes it from both dockview and the session list.

- [ ] **Step 1: Verify sidebar interactions work with split-view**

Test: click tab in sidebar → correct pane focuses. Close tab → panel removed from dockview.

- [ ] **Step 2: Commit (if changes needed)**

---
