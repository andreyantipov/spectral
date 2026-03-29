<!-- AUTO-GENERATED — do not edit manually. Run: bun run docs:meta -->

# Architecture Snapshot

Generated: 2026-03-29T19:24:11.339Z

## Packages (29)

| Package | Tier | Dependencies |
|---------|------|-------------|
| @ctrl/base.type | base | — |
| @ctrl/base.error | base | — |
| @ctrl/base.schema | base | — |
| @ctrl/base.tracing | base | — |
| @ctrl/core.contract.event-bus | core.contract | base.error, base.schema |
| @ctrl/core.contract.storage | core.contract | base.error, base.schema, base.tracing |
| @ctrl/core.contract.native | core.contract | — |
| @ctrl/core.impl.db | core.impl | base.error, base.schema, base.tracing, base.type, core.contract.storage |
| @ctrl/core.impl.native | core.impl | base.tracing, core.contract.native |
| @ctrl/core.impl.event-bus | core.impl | core.contract.event-bus, base.tracing |
| @ctrl/core.middleware.otel | core.middleware | — |
| @ctrl/domain.feature.layout | domain.feature | base.schema, base.tracing, core.contract.storage |
| @ctrl/domain.feature.omnibox | domain.feature | base.tracing |
| @ctrl/domain.feature.history | domain.feature | base.error, base.schema, base.tracing, core.contract.storage |
| @ctrl/domain.feature.session | domain.feature | base.error, base.schema, base.tracing, base.type, core.contract.storage |
| @ctrl/domain.feature.bookmark | domain.feature | base.error, base.schema, base.tracing, core.contract.storage |
| @ctrl/domain.feature.settings | domain.feature | base.tracing, core.contract.event-bus |
| @ctrl/domain.service.browsing | domain.service | base.error, base.schema, base.tracing, base.type, core.contract.event-bus, core.contract.storage, domain.feature.bookmark, domain.feature.history, domain.feature.layout, domain.feature.omnibox, domain.feature.session, domain.feature.settings |
| @ctrl/domain.service.workspace | domain.service | base.error, base.tracing, core.contract.event-bus, core.contract.storage, domain.feature.layout |
| @ctrl/wire.desktop.ui | wire.desktop | core.impl.event-bus |
| @ctrl/wire.desktop.main | wire.desktop | core.contract.event-bus, core.contract.storage, core.impl.db, core.impl.event-bus, domain.feature.bookmark, domain.feature.history, domain.feature.layout, domain.feature.omnibox, domain.feature.session, domain.feature.settings, domain.service.browsing, domain.service.workspace |
| @ctrl/ui.api | ui | core.contract.event-bus |
| @ctrl/ui.design | ui | — |
| @ctrl/ui.components | ui | ui.design |
| @ctrl/ui.feature.workspace | ui.feature | base.schema, core.contract.event-bus, ui.api |
| @ctrl/ui.feature.sidebar | ui.feature | base.schema, base.tracing, base.type, core.contract.event-bus, ui.components, ui.api, domain.feature.session |
| @ctrl/ui.feature.keyboard-provider | ui.feature | core.contract.event-bus, ui.api |
| @ctrl/ui.scene.main | ui.scene | base.type, ui.components, ui.feature.keyboard-provider, ui.feature.sidebar, ui.feature.workspace |

## Services (14)

| Service | Package | Requires | Methods |
|---------|---------|----------|---------|
| EventBus | @ctrl/core.contract.event-bus | — | send, publish, commands, events, on |
| DatabaseService | @ctrl/core.contract.storage | — | query, transaction |
| BookmarkRepository | @ctrl/core.contract.storage | — | getAll, create, remove, findByUrl |
| HistoryRepository | @ctrl/core.contract.storage | — | getAll, record, clear |
| LayoutRepository | @ctrl/core.contract.storage | — | getLayout, saveLayout |
| SessionRepository | @ctrl/core.contract.storage | — | getAll, getById, create, remove, setActive, updateCurrentIndex, addPage, removePagesAfterIndex, updatePageTitle, updatePageUrl |
| NativeApi | @ctrl/core.contract.native | — | clipboard, read, write, shell, openExternal, dialog, showOpen, window, setTitle, minimize, close |
| Lifecycle | @ctrl/core.contract.lifecycle | — | manifest, activate, deactivate, status |
| LayoutFeature | @ctrl/domain.feature.layout | LayoutRepository | getLayout, getPersistedLayout, updateLayout |
| OmniboxFeature | @ctrl/domain.feature.omnibox | — | resolve |
| HistoryFeature | @ctrl/domain.feature.history | HistoryRepository | getAll, record, clear |
| SessionFeature | @ctrl/domain.feature.session | SessionRepository | getAll, create, remove, navigate, goBack, goForward, setActive, updateTitle, updateUrl |
| BookmarkFeature | @ctrl/domain.feature.bookmark | BookmarkRepository | getAll, create, remove, isBookmarked |
| SettingsFeature | @ctrl/domain.feature.settings | — | getShortcuts |

## Event Catalog (21)

| Event/Command | Payload | Response |
|--------------|---------|----------|
| bm.remove | id: String | void |
| bm.add | url: String, title: NullOr | Bookmark |
| nav.update-title | id: String, title: String | void |
| nav.report | id: String, url: String | void |
| nav.forward | id: String | Session |
| nav.back | id: String | Session |
| nav.navigate | id: String, input: String | Session |
| session.activate | id: String | void |
| session.close | id: String | void |
| session.create | mode: Literal | Session |
| settings.shortcuts | — | Schema.Array(ShortcutBindingSchema) |
| diag.pong | message: String | void |
| diag.ping | — | void |
| state.snapshot | — | void |
| state.request | — | void |
| ui.toggle-sidebar | — | void |
| ui.toggle-omnibox | — | void |
| ws.close-panel | panelId: String | void |
| ws.move-panel | panelId: String, targetGroupId: String | void |
| ws.split-panel | panelId: String, direction: Literal, newPanel: PanelRefSchema | void |
| ws.update-layout | layout: Struct, version: Number, dockviewState: Unknown | void |

## Layer Graph (14)

- **IdentityLive** provides Identity, no dependencies
- **BrowsingServiceLive** provides BrowsingService, requires [EventBus]
- **LayoutFeatureLive** provides LayoutFeature, requires [LayoutRepository]
- **HistoryFeatureLive** provides HistoryFeature, requires [HistoryRepository]
- **BookmarkRepositoryLive** provides BookmarkRepository, no dependencies
- **HistoryRepositoryLive** provides HistoryRepository, no dependencies
- **LayoutRepositoryLive** provides LayoutRepository, no dependencies
- **SessionRepositoryLive** provides SessionRepository, no dependencies
- **SessionFeatureLive** provides SessionFeature, requires [SessionRepository]
- **BookmarkFeatureLive** provides BookmarkFeature, requires [BookmarkRepository]
- **EventBusLive** provides EventBus, no dependencies
- **IpcEventBridgeWebviewLive** provides IpcEventBridgeWebview, no dependencies
- **IpcEventBridgeLive** provides IpcEventBridge, requires [EventBus]
- **SettingsFeatureLive** provides SettingsFeature, no dependencies

