# Workspace Layout System — Design Spec

## Overview

Introduce a docking/tiling workspace layout system to ctrl.page, enabling users to split their browser window into multiple panes — each showing a session webview or tool panel. The sidebar manages all tabs (Zen Browser-style) with grouping support; panes are clean content areas with rounded corners, gaps between them, and no per-pane chrome.

## Goals

- Users can split the content area into arbitrary arrangements: left/right, top/bottom, nested splits
- Sidebar is the sole tab/panel manager — reflects the layout tree, supports grouped and ungrouped tabs
- Tab groups shown as horizontal pill containers inline in the sidebar
- Each pane renders a real native Electrobun webview, positioned to match layout bounds
- Panes have rounded corners and gaps between them, seamlessly aligned with sidebar (no sidebar border)
- Layout state persists across app restarts
- Extensible panel registry: session webviews and tool panels (bookmarks, history, devtools, etc.) from day one
- Custom context menu (not native OS) for split/close/move operations, styled with Panda CSS `sva()`

## Non-Goals (this iteration)

- Named workspaces ("Research", "Shopping") — future feature, architecture supports it
- AI-generated session titles — future, simplified for now
- Floating/popout panels — defer, focus on tiling splits first

## Architecture

### Domain Layer (Backend)

#### New Packages

| Package | Responsibility |
|---|---|
| `domain.feature.layout` | Layout tree schema (Effect Schema), persistence, split/move/resize operations |
| `domain.feature.panel` | Panel type registry, panel descriptor schemas (session, tool, future types) |
| `domain.service.workspace` | `WorkspaceRpcs` — composes layout + panel features, public API for UI |

#### Updated Packages

| Package | Change |
|---|---|
| `domain.adapter.db` | New tables/queries for layout state persistence |

#### Unchanged Packages

| Package | Notes |
|---|---|
| `domain.feature.session` | Sessions stay flat — URL, title, favicon, history |
| `domain.feature.bookmark` | No changes |
| `domain.feature.history` | No changes |
| `domain.service.browsing` | `BrowsingRpcs` unchanged — sessions/bookmarks/history/omnibox |

### Layout Tree Schema

Sessions remain flat in the database. A separate **layout descriptor** references session IDs and describes spatial arrangement:

```typescript
// Derived TypeScript types (actual implementation uses Effect Schema)

type LayoutNode =
  | SplitNode
  | GroupNode

type SplitNode = {
  readonly type: "split"
  readonly direction: "horizontal" | "vertical"
  readonly children: ReadonlyArray<LayoutNode>
  readonly sizes: ReadonlyArray<number> // proportional sizes (0-1), must sum to 1.0
}

type GroupNode = {
  readonly type: "group"
  readonly panels: ReadonlyArray<PanelRef>
  readonly activePanel: string // matches PanelRef.id
}

type PanelRef = {
  readonly id: string // unique panel identifier
  readonly type: "session" | "tool"
  readonly sessionId?: string // present when type === "session"
  readonly toolId?: string   // present when type === "tool" — "bookmarks" | "history" | ...
}
```

### Service Boundary

**`domain.service.browsing`** = navigating the web (sessions, bookmarks, history, omnibox). Answers "what am I looking at?"

**`domain.service.workspace`** = spatial arrangement of panels. Answers "how is my screen organized?" Composes sessions and tools into a layout but doesn't own them. References sessions by ID.

`WorkspaceRpcs` operations:
- `getLayout` — returns current layout tree
- `updateLayout` — persists layout changes (from dockview events)
- `splitPanel` — split a pane in a given direction with a new panel
- `movePanel` — move a panel to a different position
- `closePanel` — remove a panel from the layout
- `workspaceChanges` — stream of layout state changes (for reactive sidebar updates)

`domain.service.workspace` only references session IDs — it never calls into `BrowsingRpcs`. Composition of workspace + browsing data happens in `ui.scenes`.

Tool panel types (bookmarks, history) are statically registered in `domain.feature.panel`. No runtime registration needed for this iteration.

### UI Layer (Frontend)

#### New Packages

| Package | Responsibility |
|---|---|
| `ui.adapter.dockview` | Thin SolidJS wrapper around `dockview-core` — framework adapter, no domain knowledge |
| `ui.feature.workspace` | Panel rendering, maps domain state ↔ dockview adapter |

#### Updated Packages

| Package | Change |
|---|---|
| `ui.feature.sidebar` | Refactored for tab grouping — groups shown as inline horizontal pill containers (Zen-style) |
| `ui.scenes` | `MainScene` wires workspace + browsing together, replaces current single-webview content area |
| `ui.adapter.electrobun` | `SessionWebview` now positioned per dockview pane bounds instead of absolute stacking |
| `core.ui` | New `ContextMenu` organism with `sva()`, updated `AppShellTemplate` (simplified — workspace owns content layout, no sidebar border in split mode) |

### Dockview Integration

**Approach**: Thin SolidJS wrapper around `dockview-core` v5 (framework-agnostic, zero dependencies).

The wrapper:
- `DockviewProvider` component creates `DockviewComponent` instance
- `createComponent` factory calls SolidJS `render()` into dockview's `containerElement`
- Cleanup via `onCleanup`
- Dockview API ref exposed for imperative operations
- Dockview's native drag-and-drop for panel splitting/reordering
- Dockview's native `toJSON()`/`fromJSON()` for layout persistence

**State flow**:
1. Layout JSON loaded from DB → `fromJSON()` restores dockview layout on init
2. Dockview events (user splits, drags, resizes) → `toJSON()` → persisted via `WorkspaceRpcs`
3. Sidebar reflects dockview state reactively

### Sidebar Design (Zen Browser-style)

The sidebar is the **sole tab manager**. No per-pane tab bars in the content area.

#### Structure (top to bottom)

1. **URL bar** — shows URL of the focused session
2. **Tab list** — mix of grouped and ungrouped tabs, all inline:
   - **Tab groups**: horizontal pill container (rounded `#2A2A2A` background, `cornerRadius: 8`). Each pill shows favicon + truncated title. Active pill has lighter fill (`#3A3A3A`) + white text. Inactive pills have muted text.
   - **Ungrouped tabs**: standard rows — favicon + title + close button on active
3. **"+ New Tab"** button
4. **Separator** between grouped and ungrouped sections

#### Tab Group Pill Container

Groups are always displayed as a single horizontal row of pills in a rounded container. This is the same visual pattern regardless of tab count — pills truncate their titles to fit the available sidebar width.

**Group creation**: Tab groups are derived from the layout tree. Each `GroupNode` in the layout maps to one pill container in the sidebar. When a user splits a pane, the affected sessions form a group. Ungrouped tabs are sessions not present in any `GroupNode`.

```
┌─────────────────────────────┐
│ [🌐 Wiki..] [▶ YouTube] [🌐 Wikip..] │  ← rounded container
└─────────────────────────────┘
```

### Content Panes

- **Rounded corners** (`cornerRadius: 10`) on each pane
- **Gaps** (`8px`) between panes
- **Background** slightly lighter (`#1e1e1e`) than the app background (`#111111`), making gaps and corners visible
- **No sidebar border** — the gap between sidebar and first pane provides enough visual separation
- Each pane is a clean content area — no headers, no tabs, no chrome

### Electrobun Webview Positioning

Each pane gets a real live native webview:
- Dockview layout change events provide pane geometry (x, y, width, height)
- `syncDimensions()` updates native webview bounds to match
- All visible panes are fully interactive (no passthrough)
- Inactive/hidden sessions: `transparent` + `passthrough` attributes (existing behavior)

### Context Menu

Custom web-based context menu as `core.ui/organisms/ContextMenu`:
- Styled with `sva()`, consistent dark theme
- Icons (lucide), keyboard shortcuts, dividers, hover state
- Triggered on right-click: sidebar tabs, sidebar pill groups, content panes
- Menu items: Split Right, Split Down, Close Tab, Close Other Tabs, Move to Group, Pin Tab

### Persistence

Layout state = dockview's `toJSON()` output. Stored as a versioned JSON blob in a `workspace_layout` table via `WorkspaceRpcs.updateLayout`. Schema: `{ version: number, dockviewState: object }`. On restart, `fromJSON()` restores the layout.

**Fallback**: If layout JSON is missing (new user) or corrupted (parse failure), fall back to a single-pane layout with the active session. Never crash on bad layout data.

**Migration**: Existing users have no layout state. On first load with workspace enabled, bootstrap a single `GroupNode` containing the currently active session.

**Versioning**: The `version` field guards against dockview format changes across major versions. Migration logic runs when the stored version differs from the expected version.

**Resize performance**: Webview `syncDimensions()` calls during drag-resize are batched via `requestAnimationFrame` to avoid native view lag.

### Design Mockups

Design file: `packages/libs/core.ui/src/components/templates/WorkspaceTemplate/ui/workspaceTemplate.design.pen`

Template frames:
- **Default State** — current app layout (flat tabs, single content pane)
- **Split View with Groups** — sidebar with pill group containers + ungrouped tabs, 3-pane split content area (left full + right top/bottom) with rounded corners and gaps

### Component Inventory

#### ui.adapter.dockview (new)

| Component | Role |
|---|---|
| `DockviewProvider` | Creates `DockviewComponent`, manages lifecycle, exposes API ref |
| `createSolidRenderer` | Factory: bridges dockview `createComponent` → SolidJS `render()` |

#### ui.feature.workspace (new)

| Component | Role |
|---|---|
| `WorkspaceRoot` | Initializes workspace, wires Effect state to dockview adapter |
| `WorkspaceProvider` | Context provider — workspace operations for children |
| `PanelRenderer` | Routes panel type to correct renderer |
| `SessionPanel` | Renders session webview in a dockview panel |
| `ToolPanel` | Renders tool (bookmarks, history) in a dockview panel |
| `EmptyPanel` | Placeholder for empty panes |
| `ResizeSash` | Styled divider between panes (`sva()`) |

#### ui.feature.sidebar (refactored)

| Component | Role |
|---|---|
| `TabGroupPills` | Horizontal pill container — rounded bg, holds pill items inline |
| `TabPill` | Single pill in a group — favicon + truncated title, active/inactive states |
| `TabItem` | Ungrouped tab row — favicon + title + close (existing, updated) |

#### core.ui (new organism)

| Component | Level | Role |
|---|---|---|
| `ContextMenu` | organism | Generic context menu with `sva()`, keyboard nav, sub-menus, dividers |

## Dependencies

- `dockview-core` v5 — framework-agnostic docking layout engine (zero dependencies)
- No React dependency
- No additional DnD library (dockview handles it natively)

## Key Constraints

- `type` only, never `interface` in packages/libs/
- No `Effect.withSpan()` — use `withTracing()` from `@ctrl/core.shared`
- Effect Schema as single source of truth for domain types
- GritQL enforces all boundaries
- Session is the unit of work (`SESSION_FEATURE`)
- `BrowsingRpcs` unchanged — workspace is a separate service boundary
- Panda CSS `sva()` for all new component styling
