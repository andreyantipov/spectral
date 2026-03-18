# Sidebar & Webview Integration Rework — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the sidebar (remove broken bookmarks/history tabs, add omnibox input in header), extract Electrobun webview into `ui.adapter.electrobun`, fix title/URL tracking, persist webviews across session switches, and wire the app icon.

**Architecture:** Hexagonal architecture with ports in `core.shared`, domain features/services, and a new `ui.adapter.electrobun` package that encapsulates all `<electrobun-webview>` specifics behind a SolidJS hook. Navigation events flow from the adapter hook → callbacks → RPCs → domain service → repository → PubSub → UI.

**Tech Stack:** SolidJS, Effect, @effect/rpc, Drizzle ORM, Electrobun, Vitest

**Spec:** `docs/superpowers/specs/2026-03-18-sidebar-webview-rework-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `packages/libs/ui.adapter.electrobun/package.json` | Package manifest |
| `packages/libs/ui.adapter.electrobun/tsconfig.json` | TypeScript config |
| `packages/libs/ui.adapter.electrobun/src/index.ts` | Public exports |
| `packages/libs/ui.adapter.electrobun/src/api/use-electrobun-webview.ts` | Main hook — creates/manages `<electrobun-webview>` elements, event wiring, pool management |
| `packages/libs/ui.adapter.electrobun/src/api/webview-pool.ts` | Webview instance pool (create, show, hide, evict LRU) — in `api/` because it has DOM side effects |
| `packages/libs/ui.adapter.electrobun/src/lib/constants.ts` | `MAX_LIVE_WEBVIEWS`, preload script |
| `packages/libs/ui.adapter.electrobun/src/lib/types.ts` | `WebviewHookProps`, `WebviewTagElement` type — in `lib/` not `model/` per spec |
| `packages/apps/desktop/assets/icon.icns` | macOS app icon (user-provided) |

### Modified Files
| File | Change |
|------|--------|
| `packages/libs/core.shared/src/model/ports.ts` | Add `updatePageUrl` to `SessionRepository` |
| `packages/libs/domain.feature.session/src/api/session.feature.ts` | Add `updateUrl` method to `SessionFeature` tag + implementation |
| `packages/libs/domain.adapter.db/src/api/session.repository.ts` | Implement `updatePageUrl` |
| `packages/libs/domain.service.browsing/src/api/browsing.rpc.ts` | Add `reportNavigation` RPC |
| `packages/libs/domain.service.browsing/src/api/browsing.handlers.ts` | Implement `reportNavigation` handler |
| `packages/libs/core.ui/src/components/organisms/Sidebar/ui/Sidebar.tsx` | Replace header title with `headerContent` slot, rename `onNewTab` → `onNewSession` |
| `packages/libs/core.ui/src/components/templates/AppShellTemplate/ui/AppShellTemplate.tsx` | Remove `<electrobun-webview>`, use `props.children` for content, rename `onNewTab` → `onNewSession` |
| `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx` | Remove bookmarks/history tabs, add omnibox input in header, accept + forward webview callbacks via props |
| `packages/libs/ui.feature.sidebar/src/model/sidebar.bindings.ts` | No structural change (displayLabel already handles titles) |
| `packages/libs/ui.feature.sidebar/src/index.ts` | Export new props type |
| `packages/libs/ui.scenes/src/ui/MainScene.tsx` | Wire `useElectrobunWebview` hook, pass callbacks to SidebarFeature (no domain.service imports — all RPC access stays in ui.feature) |
| `packages/apps/desktop/electrobun.config.ts` | Add icon path + build copy |
| `docs/architecture/package-naming.md` | Add `ui.adapter.*` tier |
| `docs/architecture/dependency-matrix.md` | Add `ui.adapter.*` rules |
| `docs/architecture/fsd-segments.md` | Add `ui.adapter.*` row, fix `TAB_FEATURE` → `SESSION_FEATURE` |

---

## Task 1: App Icon & Config

**Files:**
- Create: `packages/apps/desktop/assets/` (directory — user drops `icon.icns` here)
- Modify: `packages/apps/desktop/electrobun.config.ts`

- [ ] **Step 1: Create assets directory**

```bash
mkdir -p packages/apps/desktop/assets
```

User places `icon.icns` in this directory.

- [ ] **Step 2: Update electrobun.config.ts**

In `packages/apps/desktop/electrobun.config.ts`, add icon to mac config and build copy:

```typescript
// In build.copy, add:
"assets/icon.icns": "assets/icon.icns",

// In build.mac, add:
icon: "assets/icon.icns",
```

Full mac section becomes:
```typescript
mac: {
  defaultRenderer: "native",
  icon: "assets/icon.icns",
},
```

Full copy section becomes:
```typescript
copy: {
  "src/main-ui/index.html": "views/main-ui/index.html",
  "build/main-ui/index.js": "views/main-ui/index.js",
  "build/main-ui/styles.css": "views/main-ui/styles.css",
  "build/bun-deps/node_modules": "bun/node_modules",
  "../../libs/domain.adapter.db/src/migrations": "bun/migrations",
  "assets/icon.icns": "assets/icon.icns",
},
```

- [ ] **Step 3: Commit**

```bash
git add packages/apps/desktop/assets packages/apps/desktop/electrobun.config.ts
git commit -m "feat: add macOS app icon and assets directory"
```

---

## Task 2: Add `updatePageUrl` to SessionRepository Port

**Files:**
- Modify: `packages/libs/core.shared/src/model/ports.ts:52-78`

- [ ] **Step 1: Add method to SessionRepository port**

In `packages/libs/core.shared/src/model/ports.ts`, add `updatePageUrl` to the `SessionRepository` Context.Tag, after `updatePageTitle` (line 76):

```typescript
readonly updatePageUrl: (
	sessionId: string,
	pageIndex: number,
	url: string,
) => Effect.Effect<void, DatabaseError>;
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/libs/core.shared && bunx tsgo --noEmit`
Expected: Compile errors in packages that implement `SessionRepository` (because the new method is missing) — that's OK, we'll fix those next.

- [ ] **Step 3: Commit**

```bash
git add packages/libs/core.shared/src/model/ports.ts
git commit -m "feat(core.shared): add updatePageUrl to SessionRepository port"
```

---

## Task 3: Implement `updatePageUrl` in Repository

**Files:**
- Modify: `packages/libs/domain.adapter.db/src/api/session.repository.ts:170-183`

- [ ] **Step 1: Add updatePageUrl implementation**

In `packages/libs/domain.adapter.db/src/api/session.repository.ts`, add after the `updatePageTitle` method (after line 180):

```typescript
updatePageUrl: (sessionId: string, pageIndex: number, url: string) =>
	db
		.update(pagesTable)
		.set({ url })
		.where(and(eq(pagesTable.sessionId, sessionId), eq(pagesTable.pageIndex, pageIndex)))
		.pipe(
			Effect.asVoid,
			Effect.catchAll((cause) =>
				Effect.fail(new DatabaseError({ message: "Failed to update page url", cause })),
			),
		),
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/libs/domain.adapter.db && bunx tsgo --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/libs/domain.adapter.db/src/api/session.repository.ts
git commit -m "feat(domain.adapter.db): implement updatePageUrl in session repository"
```

---

## Task 4: Add `updateUrl` to SessionFeature

**Files:**
- Modify: `packages/libs/domain.feature.session/src/api/session.feature.ts:12-31` (tag) and `96-109` (implementation)

- [ ] **Step 1: Add to SessionFeature Context.Tag**

In `packages/libs/domain.feature.session/src/api/session.feature.ts`, add to the tag interface (after `updateTitle` at line 28):

```typescript
readonly updateUrl: (
	id: string,
	url: string,
) => Effect.Effect<Session, DatabaseError | ValidationError>;
```

- [ ] **Step 2: Add implementation**

In the same file, add the implementation inside `withTracing` (after the `updateTitle` method, before `changes`):

```typescript
updateUrl: (id: string, url: string) =>
	Effect.gen(function* () {
		const session = yield* getSessionOrFail(id);
		yield* repo.updatePageUrl(id, session.currentIndex, url);
		yield* notify().pipe(Effect.ignore);
		return yield* getSessionOrFail(id);
	}),
```

- [ ] **Step 3: Verify types compile**

Run: `cd packages/libs/domain.feature.session && bunx tsgo --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/libs/domain.feature.session/src/api/session.feature.ts
git commit -m "feat(domain.feature.session): add updateUrl method to SessionFeature"
```

---

## Task 5: Add `reportNavigation` RPC

**Files:**
- Modify: `packages/libs/domain.service.browsing/src/api/browsing.rpc.ts:48-51`
- Modify: `packages/libs/domain.service.browsing/src/api/browsing.handlers.ts:33-34`

- [ ] **Step 1: Add RPC to BrowsingRpcs**

In `packages/libs/domain.service.browsing/src/api/browsing.rpc.ts`, add after the `updateTitle` RPC (after line 52):

```typescript
Rpc.make("reportNavigation", {
	payload: { id: Schema.String, url: Schema.String },
	success: SessionSchema,
	error: Schema.Union(DatabaseError, ValidationError),
}),
```

- [ ] **Step 2: Add handler implementation**

In `packages/libs/domain.service.browsing/src/api/browsing.handlers.ts`, add after the `updateTitle` handler (after line 34):

```typescript
reportNavigation: ({ id, url }: { readonly id: string; readonly url: string }) =>
	Effect.gen(function* () {
		const session = yield* sessions.updateUrl(id, url);
		yield* history.record(url, null, null).pipe(Effect.ignore);
		return session;
	}),
```

- [ ] **Step 3: Verify types compile**

Run: `cd packages/libs/domain.service.browsing && bunx tsgo --noEmit`
Expected: PASS

- [ ] **Step 4: Run full typecheck**

Run: `turbo check`
Expected: All packages pass

- [ ] **Step 5: Commit**

```bash
git add packages/libs/domain.service.browsing/src/api/browsing.rpc.ts packages/libs/domain.service.browsing/src/api/browsing.handlers.ts
git commit -m "feat(domain.service.browsing): add reportNavigation RPC for webview-reported navigation"
```

---

## Task 6: Create `ui.adapter.electrobun` Package

**Files:**
- Create: `packages/libs/ui.adapter.electrobun/package.json`
- Create: `packages/libs/ui.adapter.electrobun/tsconfig.json`
- Create: `packages/libs/ui.adapter.electrobun/src/index.ts`
- Create: `packages/libs/ui.adapter.electrobun/src/lib/types.ts`
- Create: `packages/libs/ui.adapter.electrobun/src/lib/constants.ts`
- Create: `packages/libs/ui.adapter.electrobun/src/api/webview-pool.ts`
- Create: `packages/libs/ui.adapter.electrobun/src/api/use-electrobun-webview.ts`

- [ ] **Step 1: Create package.json**

```json
{
	"name": "@ctrl/ui.adapter.electrobun",
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
		"@ctrl/core.shared": "workspace:*",
		"solid-js": "catalog:"
	}
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
	"extends": "../../../tsconfig.json",
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "solid-js",
		"outDir": "dist",
		"rootDir": "src"
	},
	"include": ["src"],
	"references": [
		{ "path": "../core.shared" }
	]
}
```

- [ ] **Step 3: Create lib/types.ts**

```typescript
import type { JSX } from "solid-js";

export type WebviewTagElement = HTMLElement & {
	loadURL: (url: string) => void;
	reload: () => void;
	goBack: () => void;
	goForward: () => void;
	canGoBack: () => boolean;
	canGoForward: () => boolean;
	toggleHidden: (hidden?: boolean) => void;
	togglePassthrough: (passthrough?: boolean) => void;
	syncDimensions: (force?: boolean) => void;
	addMaskSelector: (selector: string) => void;
	removeMaskSelector: (selector: string) => void;
	executeJavascript: (js: string) => Promise<unknown>;
	on: (event: string, handler: (event: CustomEvent) => void) => void;
	off: (event: string, handler: (event: CustomEvent) => void) => void;
};

export type WebviewHookProps = {
	readonly sessionId: string;
	readonly url: string;
	readonly onNavigate: (url: string) => void;
	readonly onTitleChange: (title: string) => void;
	readonly onDomReady: () => void;
	readonly maskSelectors?: readonly string[];
};

export type WebviewHookResult = {
	readonly containerRef: (el: HTMLDivElement) => void;
};
```

- [ ] **Step 4: Create lib/constants.ts**

```typescript
export const MAX_LIVE_WEBVIEWS = 10;

// Preload script: forwards Cmd+K, Cmd+L, Escape from webview tag to host
export const SHORTCUT_PRELOAD = `
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    window.__electrobunSendToHost({ type: 'shortcut', key: 'cmd+k' });
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
    e.preventDefault();
    window.__electrobunSendToHost({ type: 'shortcut', key: 'cmd+l' });
  }
  if (e.key === 'Escape') {
    window.__electrobunSendToHost({ type: 'shortcut', key: 'escape' });
  }
});
`;
```

- [ ] **Step 5: Create api/webview-pool.ts** (in `api/` because it has DOM side effects — `lib/` must be pure)

```typescript
import type { WebviewTagElement } from "../lib/types";
import { MAX_LIVE_WEBVIEWS, SHORTCUT_PRELOAD } from "../lib/constants";

type PoolEntry = {
	el: WebviewTagElement;
	sessionId: string;
	lastActive: number;
};

export function createWebviewPool() {
	const pool = new Map<string, PoolEntry>();

	function createWebview(sessionId: string, url: string): WebviewTagElement {
		const el = document.createElement("electrobun-webview") as unknown as WebviewTagElement;
		(el as unknown as HTMLElement).setAttribute("preload", SHORTCUT_PRELOAD);
		(el as unknown as HTMLElement).style.cssText =
			"width: 100%; height: 100%; display: block; background: #fff;";
		if (url && url !== "about:blank") {
			el.loadURL(url);
		}
		return el;
	}

	function evictLRU() {
		if (pool.size <= MAX_LIVE_WEBVIEWS) return;
		let oldest: string | null = null;
		let oldestTime = Number.POSITIVE_INFINITY;
		for (const [id, entry] of pool) {
			if (entry.lastActive < oldestTime) {
				oldest = id;
				oldestTime = entry.lastActive;
			}
		}
		if (oldest) {
			const entry = pool.get(oldest);
			if (entry) {
				(entry.el as unknown as HTMLElement).remove();
				pool.delete(oldest);
			}
		}
	}

	return {
		get(sessionId: string): PoolEntry | undefined {
			return pool.get(sessionId);
		},

		getOrCreate(sessionId: string, url: string): PoolEntry {
			let entry = pool.get(sessionId);
			if (!entry) {
				evictLRU();
				const el = createWebview(sessionId, url);
				entry = { el, sessionId, lastActive: Date.now() };
				pool.set(sessionId, entry);
			} else {
				entry.lastActive = Date.now();
			}
			return entry;
		},

		hideAll() {
			for (const entry of pool.values()) {
				(entry.el as unknown as HTMLElement).style.display = "none";
			}
		},

		show(sessionId: string) {
			const entry = pool.get(sessionId);
			if (entry) {
				(entry.el as unknown as HTMLElement).style.display = "block";
			}
		},

		remove(sessionId: string) {
			const entry = pool.get(sessionId);
			if (entry) {
				(entry.el as unknown as HTMLElement).remove();
				pool.delete(sessionId);
			}
		},

		syncMasks(selectors: readonly string[]) {
			for (const entry of pool.values()) {
				for (const sel of selectors) {
					entry.el.addMaskSelector(sel);
				}
				entry.el.syncDimensions(true);
			}
		},
	};
}
```

- [ ] **Step 6: Create api/use-electrobun-webview.ts**

```typescript
import { createEffect, onCleanup, onMount } from "solid-js";
import type { WebviewHookProps, WebviewHookResult, WebviewTagElement } from "../lib/types";
import { createWebviewPool } from "./webview-pool";

export function useElectrobunWebview(props: () => WebviewHookProps): WebviewHookResult {
	const pool = createWebviewPool();
	let containerEl: HTMLDivElement | undefined;

	function attachEvents(el: WebviewTagElement, sessionId: string) {
		const handleNavigate = (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url) props().onNavigate(url);
		};

		const handleNavigateInPage = (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url) props().onNavigate(url);
		};

		const handleDomReady = () => {
			props().onDomReady();
			// Extract title after DOM is ready
			el.executeJavascript("document.title")
				.then((title) => {
					if (typeof title === "string" && title.length > 0) {
						props().onTitleChange(title);
					}
				})
				.catch(() => {
					// Title extraction failed — skip silently, fallback to URL hostname
				});
		};

		const handleHostMessage = (event: CustomEvent) => {
			// Forward host messages for shortcut handling
			const el = containerEl?.closest("[data-app-shell]");
			if (el) {
				el.dispatchEvent(new CustomEvent("webview-host-message", { detail: event.detail, bubbles: true }));
			}
		};

		el.on("did-navigate", handleNavigate);
		el.on("did-navigate-in-page", handleNavigateInPage);
		el.on("dom-ready", handleDomReady);
		el.on("host-message", handleHostMessage);

		return () => {
			el.off("did-navigate", handleNavigate);
			el.off("did-navigate-in-page", handleNavigateInPage);
			el.off("dom-ready", handleDomReady);
			el.off("host-message", handleHostMessage);
		};
	}

	let cleanupEvents: (() => void) | undefined;

	// React to session/URL changes
	createEffect(() => {
		const { sessionId, url } = props();
		if (!containerEl) return;

		cleanupEvents?.();
		pool.hideAll();

		const entry = pool.getOrCreate(sessionId, url);
		const el = entry.el as unknown as HTMLElement;

		if (!el.parentElement) {
			containerEl.appendChild(el);
		}
		pool.show(sessionId);

		cleanupEvents = attachEvents(entry.el, sessionId);
	});

	// React to mask selector changes
	createEffect(() => {
		const masks = props().maskSelectors ?? [];
		if (masks.length > 0) {
			pool.syncMasks(masks);
		}
	});

	onCleanup(() => {
		cleanupEvents?.();
	});

	return {
		containerRef: (el: HTMLDivElement) => {
			containerEl = el;
		},
	};
}
```

- [ ] **Step 7: Create src/index.ts**

```typescript
export { useElectrobunWebview } from "./api/use-electrobun-webview";
export type { WebviewHookProps, WebviewHookResult } from "./lib/types";
```

- [ ] **Step 8: Install dependencies**

Run: `cd packages/libs/ui.adapter.electrobun && bun install`

- [ ] **Step 9: Verify types compile**

Run: `cd packages/libs/ui.adapter.electrobun && bunx tsgo --noEmit`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add packages/libs/ui.adapter.electrobun
git commit -m "feat: create ui.adapter.electrobun package with useElectrobunWebview hook"
```

---

## Task 7: Sidebar Cleanup — Remove Bookmarks/History Tabs

**Files:**
- Modify: `packages/libs/core.ui/src/components/organisms/Sidebar/ui/Sidebar.tsx:19-38` (props), `123-140` (header)
- Modify: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx:13-17` (tabs), `77-84` (sidebar props)

- [ ] **Step 1: Rename `onNewTab` → `onNewSession` in Sidebar.tsx**

In `packages/libs/core.ui/src/components/organisms/Sidebar/ui/Sidebar.tsx`:
- Line 33: Rename `onNewTab` → `onNewSession` in SidebarProps
- Line 129: Update `<Show when={props.onNewSession}>` (was `props.onNewTab`)
- Line 133: Update `onClick={() => props.onNewSession?.()}` (was `props.onNewTab`)
- Line 134: Update title to `"New session"` (was `"New tab"`)

- [ ] **Step 2: Add `headerContent` slot to Sidebar.tsx**

In the `SidebarProps` type, add:
```typescript
headerContent?: JSX.Element;
```

Replace the header title span (line 124-126) with a conditional:
```typescript
<div class={$().panelHeader}>
	<Show when={props.headerContent} fallback={
		<span class={$().panelTitle}>
			{props.tabs.find((t) => t.id === props.activeTabId)?.label ?? ""}
		</span>
	}>
		{props.headerContent}
	</Show>
	<div class={$().panelActions}>
		{props.panelActions}
		<Show when={props.onNewSession}>
			<button
				type="button"
				class={$().panelAction}
				onClick={() => props.onNewSession?.()}
				title="New session"
			>
				+
			</button>
		</Show>
	</div>
</div>
```

- [ ] **Step 3: Remove bookmarks/history tabs from SidebarFeature.tsx**

In `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx`, replace lines 13-17:

```typescript
const sidebarTabs = [
	{ id: "sessions", icon: (<span>{"\u2630"}</span>) as JSX.Element, label: "Sessions" },
];
```

- [ ] **Step 4: Rename `onNewTab` → `onNewSession` in SidebarFeature.tsx**

Line 47: Rename function `handleNewTab` → `handleNewSession`
Line 82: Change `onNewTab: handleNewSession` to `onNewSession: handleNewSession`

- [ ] **Step 5: Rename in AppShellTemplate.tsx**

In `packages/libs/core.ui/src/components/templates/AppShellTemplate/ui/AppShellTemplate.tsx`:
- Line 68-71: Rename `handleNewTab` → `handleNewSession`, update `props.sidebar.onNewSession?.()`
- Line 148: Update `<Sidebar {...props.sidebar} onNewSession={handleNewSession} />`

- [ ] **Step 6: Verify types compile**

Run: `turbo check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/libs/core.ui packages/libs/ui.feature.sidebar
git commit -m "feat: remove bookmarks/history tabs from sidebar, rename onNewTab to onNewSession"
```

---

## Task 8: Omnibox Input in Sidebar Header

**Files:**
- Modify: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx`

- [ ] **Step 1: Add omnibox input in sidebar header**

In `SidebarFeature.tsx`, create a header content element that shows the current URL and opens the omnibox on focus. Add to the component body (before the return):

```typescript
const [headerFocused, setHeaderFocused] = createSignal(false);

const headerInput = () => (
	<input
		type="text"
		value={headerFocused() ? omniboxQuery() : (activeUrl() ?? "")}
		placeholder="Search or enter URL..."
		onFocus={() => setHeaderFocused(true)}
		onBlur={() => {
			setHeaderFocused(false);
			setOmniboxQuery("");
		}}
		onInput={(e) => handleOmniboxInput(e.currentTarget.value)}
		onKeyDown={(e) => {
			if (e.key === "Enter") {
				e.currentTarget.blur();
				handleOmniboxSubmit(e.currentTarget.value);
			}
			if (e.key === "Escape") {
				e.currentTarget.blur();
			}
		}}
		style={{
			"flex": "1",
			"background": "transparent",
			"border": "none",
			"color": "inherit",
			"font-size": "inherit",
			"outline": "none",
			"min-width": "0",
		}}
	/>
);
```

Pass it to the sidebar:
```typescript
sidebar={{
	tabs: sidebarTabs,
	activeTabId: "sessions",
	headerContent: headerInput(),
	items: items(),
	activeItemId: activeItemId(),
	onNewSession: handleNewSession,
	onItemClick: handleItemClick,
	onItemClose: handleItemClose,
}}
```

- [ ] **Step 2: Verify types compile**

Run: `turbo check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx
git commit -m "feat: add omnibox input in sidebar header replacing SESSIONS title"
```

---

## Task 9: Extract Webview from AppShellTemplate

**Files:**
- Modify: `packages/libs/core.ui/src/components/templates/AppShellTemplate/ui/AppShellTemplate.tsx`

- [ ] **Step 1: Remove electrobun-webview from AppShellTemplate**

Remove from `AppShellTemplate.tsx`:
- The `WebviewTagElement` type (lines 8-17)
- The `SHORTCUT_PRELOAD` constant (lines 24-38)
- The `webviewRef` and related state (line 50-51)
- The `setupWebview` function (lines 116-124)
- The `syncDimensions` effect (lines 129-137)
- The `loadURL` effect (lines 139-144)
- The `<Dynamic component="electrobun-webview" ...>` block (lines 152-160)
- The cleanup of webviewRef (line 113)
- Remove `currentUrl` from `AppShellTemplateProps`

Keep:
- OmniBox overlay logic (it will work with the sidebar header input)
- IPC bridge subscription for Cmd+K
- Keyboard shortcut handlers
- `handleHostMessage` — but refactor to listen for a bubbling `webview-host-message` CustomEvent instead of directly on the webview ref

Replace the content area with just `props.children`:

```typescript
<div class={$().content}>
	<div class={$().page}>
		{props.children}
	</div>

	<Show when={omniboxOpen()}>
		<div class={$().omniboxOverlay}>
			<OmniBox {...props.omniBox} onSubmit={handleOmniboxSubmit} onCancel={closeOmnibox} />
		</div>
	</Show>
</div>
```

- [ ] **Step 2: Update SidebarFeature to pass webview container as children**

In `SidebarFeature.tsx`, update the return to pass through children (the webview container will come from MainScene):

```typescript
<AppShellTemplate
	sidebar={{...}}
	omniBox={{...}}
>
	{props.children}
</AppShellTemplate>
```

Remove `currentUrl={activeUrl()}` from AppShellTemplate props.

- [ ] **Step 3: Verify types compile**

Run: `turbo check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/libs/core.ui packages/libs/ui.feature.sidebar
git commit -m "refactor: extract electrobun-webview from AppShellTemplate, use children slot"
```

---

## Task 10: Wire Everything — SidebarFeature Callbacks + MainScene

**Architecture note:** `ui.scenes` must NOT import from `domain.service.*` (dependency matrix). All RPC access stays in `ui.feature.sidebar`. `MainScene` only imports from `ui.feature.*` and `ui.adapter.*`.

**Files:**
- Modify: `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx` — accept + forward webview callbacks
- Modify: `packages/libs/ui.feature.sidebar/src/index.ts` — export new props type
- Modify: `packages/libs/ui.scenes/src/ui/MainScene.tsx` — wire hook + pass callbacks
- Modify: `packages/libs/ui.scenes/package.json` — add adapter dependency
- Modify: `packages/libs/ui.scenes/tsconfig.json` — add adapter reference

- [ ] **Step 1: Extend SidebarFeatureProps with webview callbacks**

In `packages/libs/ui.feature.sidebar/src/ui/SidebarFeature.tsx`, update the props type:

```typescript
export type SidebarFeatureProps = {
	children?: JSX.Element;
	webview?: {
		readonly containerRef: (el: HTMLDivElement) => void;
	};
};
```

`SidebarFeature` already has the RPC client. Add callbacks that will be exposed to the scene for webview event handling. Add these functions inside the component:

```typescript
const handleWebviewNavigate = (url: string) => {
	const session = activeSession();
	if (session) {
		void runtime.runPromise(client.reportNavigation({ id: session.id, url }));
	}
};

const handleWebviewTitleChange = (title: string) => {
	const session = activeSession();
	if (session) {
		void runtime.runPromise(client.updateTitle({ id: session.id, title }));
	}
};
```

But wait — the scene needs these callbacks BEFORE rendering SidebarFeature (to pass to the hook). Instead, expose them as a return value from a new hook.

**Better approach:** Create a new hook `useBrowsingCallbacks` in `ui.feature.sidebar` that returns the callbacks the scene needs:

In `packages/libs/ui.feature.sidebar/src/api/use-browsing-callbacks.ts`:

```typescript
import { currentUrl } from "@ctrl/core.shared";
import { useBrowsingRpc } from "./use-sidebar";

export function useBrowsingCallbacks() {
	const { client, state } = useBrowsingRpc();

	const activeSession = () => state()?.sessions?.find((s) => s.isActive);
	const activeUrl = () => {
		const session = activeSession();
		return session ? currentUrl(session) : undefined;
	};

	return {
		activeSessionId: () => activeSession()?.id ?? "",
		activeUrl,
		onNavigate: (url: string) => {
			const session = activeSession();
			if (session) {
				void client.reportNavigation({ id: session.id, url });
			}
		},
		onTitleChange: (title: string) => {
			const session = activeSession();
			if (session) {
				void client.updateTitle({ id: session.id, title });
			}
		},
	};
}
```

- [ ] **Step 2: Export the new hook**

In `packages/libs/ui.feature.sidebar/src/index.ts`:

```typescript
export { SidebarFeature, type SidebarFeatureProps } from "./ui/SidebarFeature";
export { useBrowsingCallbacks } from "./api/use-browsing-callbacks";
```

- [ ] **Step 3: Add ui.adapter.electrobun dependency to ui.scenes**

In `packages/libs/ui.scenes/package.json`, add to dependencies:
```json
"@ctrl/ui.adapter.electrobun": "workspace:*"
```

In `packages/libs/ui.scenes/tsconfig.json`, add to references:
```json
{ "path": "../ui.adapter.electrobun" }
```

Run: `bun install`

- [ ] **Step 4: Wire MainScene**

Replace `packages/libs/ui.scenes/src/ui/MainScene.tsx`:

```typescript
import { useElectrobunWebview } from "@ctrl/ui.adapter.electrobun";
import { SidebarFeature, useBrowsingCallbacks } from "@ctrl/ui.feature.sidebar";

export function MainScene() {
	const browsing = useBrowsingCallbacks();

	const webview = useElectrobunWebview(() => ({
		sessionId: browsing.activeSessionId(),
		url: browsing.activeUrl() ?? "about:blank",
		onNavigate: browsing.onNavigate,
		onTitleChange: browsing.onTitleChange,
		onDomReady: () => {},
	}));

	return (
		<SidebarFeature>
			<div ref={webview.containerRef} style="width: 100%; height: 100%;" />
		</SidebarFeature>
	);
}
```

Note: `MainScene` imports ONLY from `ui.feature.*` and `ui.adapter.*` — no `domain.service.*` imports. All RPC access is inside `useBrowsingCallbacks` which lives in `ui.feature.sidebar`.

- [ ] **Step 5: Verify types compile**

Run: `turbo check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/libs/ui.feature.sidebar packages/libs/ui.scenes
git commit -m "feat: wire useElectrobunWebview in MainScene via useBrowsingCallbacks"
```

---

## Task 11: Update Architecture Docs

**Files:**
- Modify: `docs/architecture/package-naming.md`
- Modify: `docs/architecture/dependency-matrix.md`
- Modify: `docs/architecture/fsd-segments.md`

- [ ] **Step 1: Update package-naming.md**

Add `ui.adapter.*` tier to the UI Tiers table. Change the section from "UI Tiers (`f → s`)" to "UI Tiers (`a → f → s`)":

```markdown
## UI Tiers (`a → f → s`)

The second level of `ui.*.*` encodes the presentation layer:

| Tier | Package format | Role | Depends on |
|------|---------------|------|------------|
| adapter | `ui.adapter.<name>` | Driven adapter (Electrobun, platform integration) | `core.shared` + external |
| feature | `ui.feature.<name>` | Wires a domain service to a component | `domain.service.*` + `core.ui` + `core.shared` |
| scenes | `ui.scenes` | Single package containing all scene compositions | `ui.feature.*` + `ui.adapter.*` + `core.ui` |

Alphabetical `a → f → s` matches dependency direction within `ui`.
```

- [ ] **Step 2: Update dependency-matrix.md**

Add `ui.adapter.*` row to the Full Dependency Table:
```markdown
| `ui.adapter.*` | `core.shared` + external platform libs |
```

Update `ui.scenes` row:
```markdown
| `ui.scenes` | `ui.feature.*` + `ui.adapter.*` + `core.ui` |
```

Add to peer isolation rule:
```markdown
- `ui.adapter.*` packages cannot import each other — adapters are independent
```

Add GritQL rule note:
```markdown
- `ui.adapter.*` may only import `core.shared` and external packages
- `ui.feature.*` may NOT import `ui.adapter.*`
- `ui.scenes` may import `ui.adapter.*`
```

- [ ] **Step 3: Update fsd-segments.md**

Add `ui.adapter.*` row to the segments table:
```
ui.adapter.*                         ✓       ✓
```

Fix stale reference on line 55: change `TAB_FEATURE` to `SESSION_FEATURE`.
Fix stale reference on line 42: change `domain.feature.tab` to `domain.feature.session`.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture
git commit -m "docs: add ui.adapter.* tier to architecture docs, fix stale TAB references"
```

---

## Task 12: End-to-End Verification

- [ ] **Step 1: Full typecheck**

Run: `turbo check`
Expected: All packages pass

- [ ] **Step 2: GritQL boundary check**

Run: `bunx grit check .`
Expected: No boundary violations (may need to add GritQL rules for `ui.adapter.*` if not already present)

- [ ] **Step 3: Run all tests**

Run: `turbo test`
Expected: All existing tests pass

- [ ] **Step 4: Manual smoke test**

Build and run the desktop app:
1. Verify the sidebar shows only the sessions tab (no bookmarks/history icons)
2. Verify the header shows an input field instead of "SESSIONS"
3. Verify typing in the input and pressing Enter navigates the active session
4. Verify switching sessions does NOT reload the webview (page state preserved)
5. Verify clicking links in a webview updates the tab label in the sidebar
6. Verify the app icon appears in the dock (if icon.icns was provided)

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```
