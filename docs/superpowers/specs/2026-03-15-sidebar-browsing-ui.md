# Sidebar & Browsing UI Spec

**Date:** 2026-03-15
**Purpose:** Design brief for reworking the sidebar and wiring it to the browsing service

---

## 1. What the Backend Provides

The UI receives a real-time `BrowsingState` stream via RPC with three data sets:

### Sessions (tabs)
```
Session {
  id: string
  pages: Page[]           // browsing history within this session
  currentIndex: number    // which page is "current" (for back/forward)
  mode: "visual"
  isActive: boolean       // exactly one session is active at a time
  createdAt, updatedAt: string
}

Page {
  url: string
  title: string | null
  loadedAt: string
}
```

**Derived helpers available:**
- `currentPage(session)` → the page at `currentIndex`
- `currentUrl(session)` → URL of current page (or `"about:blank"`)
- `canGoBack(session)` → `currentIndex > 0`
- `canGoForward(session)` → `currentIndex < pages.length - 1`
- Display label: `page.title ?? hostname ?? url`

### Bookmarks
```
Bookmark {
  id: string
  url: string
  title: string | null
  createdAt: string
}
```

### History
```
HistoryEntry {
  id: string
  url: string
  title: string | null
  visitedAt: string
}
```

---

## 2. Available Actions (RPC calls)

### Session actions
| Action | What it does |
|--------|-------------|
| `createSession({ mode: "visual" })` | Create new tab, auto-activates |
| `removeSession({ id })` | Close tab |
| `setActive({ id })` | Switch to tab |
| `navigate({ id, url })` | Navigate active session to URL (auto-records history) |
| `goBack({ id })` | Go back in session page history |
| `goForward({ id })` | Go forward in session page history |
| `updateTitle({ id, title })` | Update current page title |

### Bookmark actions
| Action | What it does |
|--------|-------------|
| `addBookmark({ url, title })` | Bookmark a URL |
| `removeBookmark({ id })` | Remove bookmark |
| `isBookmarked({ url })` | Check if URL is bookmarked |

### History actions
| Action | What it does |
|--------|-------------|
| `clearHistory()` | Clear all browsing history |

---

## 3. UI Responsibilities

### Sidebar
The sidebar needs to support **multiple views** switchable via the icon rail:

1. **Sessions/Tabs view** — list of open sessions, each showing:
   - Display label (page title or hostname)
   - Active indicator (one at a time)
   - Close button (×)
   - "New tab" action (+)

2. **Bookmarks view** — list of saved bookmarks, each showing:
   - Title or URL
   - Click to open in active session (calls `navigate`)
   - Remove action

3. **History view** — list of visited pages (reverse chronological), each showing:
   - Title or URL
   - Timestamp
   - Click to open in active session (calls `navigate`)
   - "Clear all" action

### Address bar (not in sidebar — sits above the content area)
- Shows current URL of active session
- Editable — submitting navigates: `navigate({ id: activeSession.id, url })`
- Back/Forward buttons (enabled based on `canGoBack`/`canGoForward`)
- Bookmark toggle (star icon, filled if `isBookmarked`)

---

## 4. Data Flow

```
browsingChanges stream (real-time)
    ↓
BrowsingState { sessions, bookmarks, history }
    ↓
UI splits into three views:
    ├── Sessions view ← sessions[]
    ├── Bookmarks view ← bookmarks[]
    └── History view ← history[]

User actions → RPC calls → state updates → stream emits → UI re-renders
```

The stream is reactive — any mutation (create session, add bookmark, navigate) automatically pushes updated state to the UI. No polling needed.

---

## 5. Current Sidebar Component API

The existing `Sidebar` organism in `core.ui` accepts:

```typescript
type SidebarProps = {
  tabs: SidebarTab[]           // icon rail items (sessions, bookmarks, history)
  activeTabId: string | null   // which rail tab is selected
  items: SidebarItem[]         // list items for the active view
  activeItemId: string | null  // highlighted item
  position: "left" | "right"
  collapsed: boolean
  onTabClick, onItemClick, onItemClose, onNewTab
  onWidthChange, onCollapseChange
  children?: JSX.Element       // custom content in the panel
}
```

This API may need extending or the component may need reworking to support the three different views with different item shapes and actions.

---

## 6. What's NOT Wired Yet

- **ViewManager** (Bun side) — manages native BrowserView but isn't connected to `browsingChanges`. Needs to create/navigate/destroy BrowserViews when sessions change.
- **Address bar** — doesn't exist yet. Needs to be a component in the webview UI.
- **Bookmark star** — no UI for toggling bookmarks.
- **History view** — no UI for browsing history.

These will be wired after the sidebar design is ready.

---

## 7. Layout

```
┌─────────────────────────────────────────────┐
│  (titlebar - hiddenInset, 44px)             │
├────┬────────────┬───────────────────────────┤
│    │  PANEL     │  [← →] [URL bar    ] [★]  │  ← address bar (44px)
│ R  │            ├───────────────────────────┤
│ A  │  items     │                           │
│ I  │  list      │     BrowserView           │
│ L  │            │     (native webview)      │
│    │            │                           │
│ 48 │  180-400px │     flex: 1               │
└────┴────────────┴───────────────────────────┘
```

Rail icons: Sessions (tabs), Bookmarks (star), History (clock)
