<!-- AUTO-GENERATED — do not edit manually. Run: bun run docs:meta -->

# Architecture Snapshot

Generated: 2026-03-28T19:38:32.702Z

## Packages (22)

| Package | Tier | Dependencies |
|---------|------|-------------|
| @ctrl/core.base.model | core.base | — |
| @ctrl/core.base.tracing | core.base | — |
| @ctrl/core.base.types | core.base | — |
| @ctrl/core.base.errors | core.base | — |
| @ctrl/core.port.event-bus | core.port | core.base.model |
| @ctrl/core.port.storage | core.port | core.base.errors, core.base.model, core.base.tracing |
| @ctrl/core.ui | core.ui | core.ui.api, core.port.event-bus |
| @ctrl/core.ui.api | core.ui | core.port.event-bus |
| @ctrl/domain.adapter.otel | domain.adapter | — |
| @ctrl/domain.adapter.electrobun | domain.adapter | — |
| @ctrl/domain.adapter.db | domain.adapter | core.base.errors, core.base.model, core.base.tracing, core.base.types, core.port.storage |
| @ctrl/domain.adapter.rpc | domain.adapter | — |
| @ctrl/domain.feature.layout | domain.feature | core.base.tracing, core.port.storage |
| @ctrl/domain.feature.omnibox | domain.feature | core.base.tracing |
| @ctrl/domain.feature.history | domain.feature | core.base.errors, core.base.model, core.port.storage |
| @ctrl/domain.feature.session | domain.feature | core.base.errors, core.base.model, core.base.tracing, core.base.types, core.port.storage |
| @ctrl/domain.feature.bookmark | domain.feature | core.base.errors, core.base.model, core.port.storage |
| @ctrl/domain.service.browsing | domain.service | core.base.errors, core.base.model, core.base.tracing, core.base.types, core.port.event-bus, core.port.storage, domain.adapter.otel, domain.feature.bookmark, domain.feature.history, domain.feature.omnibox, domain.feature.session |
| @ctrl/domain.service.workspace | domain.service | core.base.errors, core.base.tracing, core.port.storage, domain.feature.layout |
| @ctrl/ui.feature.workspace | ui.feature | core.ui, domain.service.workspace |
| @ctrl/ui.feature.sidebar | ui.feature | core.base.model, core.base.tracing, core.base.types, core.port.event-bus, core.ui, core.ui.api, domain.feature.session |
| @ctrl/ui.scenes | ui.scenes | core.base.types, core.ui, ui.feature.sidebar, ui.feature.workspace |

## Services (11)

| Service | Package | Requires | Methods |
|---------|---------|----------|---------|
| EventBus | @ctrl/core.port.event-bus | — | send, publish, commands, events, on |
| DatabaseService | @ctrl/core.port.storage | — | query, transaction |
| BookmarkRepository | @ctrl/core.port.storage | — | getAll, create, remove, findByUrl |
| HistoryRepository | @ctrl/core.port.storage | — | getAll, record, clear |
| LayoutRepository | @ctrl/core.port.storage | — | getLayout, saveLayout |
| SessionRepository | @ctrl/core.port.storage | — | getAll, getById, create, remove, setActive, updateCurrentIndex, addPage, removePagesAfterIndex, updatePageTitle, updatePageUrl |
| LayoutFeature | @ctrl/domain.feature.layout | LayoutRepository | getLayout, getPersistedLayout, updateLayout, changes |
| OmniboxFeature | @ctrl/domain.feature.omnibox | — | resolve |
| HistoryFeature | @ctrl/domain.feature.history | HistoryRepository | getAll, record, clear, changes |
| SessionFeature | @ctrl/domain.feature.session | SessionRepository | getAll, create, remove, navigate, goBack, goForward, setActive, updateTitle, updateUrl, changes |
| BookmarkFeature | @ctrl/domain.feature.bookmark | BookmarkRepository | getAll, create, remove, isBookmarked, changes |

## Event Catalog (10)

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

## Layer Graph (10)

- **EventBusLive** provides EventBus, no dependencies
- **BrowsingServiceLive** provides BrowsingService, requires [EventBus]
- **LayoutFeatureLive** provides LayoutFeature, requires [LayoutRepository]
- **BookmarkRepositoryLive** provides BookmarkRepository, no dependencies
- **HistoryRepositoryLive** provides HistoryRepository, no dependencies
- **LayoutRepositoryLive** provides LayoutRepository, no dependencies
- **SessionRepositoryLive** provides SessionRepository, no dependencies
- **HistoryFeatureLive** provides HistoryFeature, requires [HistoryRepository]
- **SessionFeatureLive** provides SessionFeature, requires [SessionRepository]
- **BookmarkFeatureLive** provides BookmarkFeature, requires [BookmarkRepository]

