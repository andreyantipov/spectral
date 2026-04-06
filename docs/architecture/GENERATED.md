<!-- AUTO-GENERATED — do not edit manually. Run: bun run docs:meta -->

# Architecture Snapshot

Generated: 2026-04-06T22:08:28.799Z

## Packages (45)

| Package | Tier | Dependencies |
|---------|------|-------------|
| @ctrl/base.model.history | base | base.error, base.schema, base.tracing |
| @ctrl/base.model.session | base | base.error, base.schema, base.tracing, base.type |
| @ctrl/base.tracing | base | — |
| @ctrl/base.type | base | — |
| @ctrl/base.spec.web-session | base | arch.util.spec-builder |
| @ctrl/base.schema | base | — |
| @ctrl/base.model.bookmark | base | base.error, base.schema, base.tracing |
| @ctrl/base.error | base | — |
| @ctrl/base.event | base | base.error, base.schema |
| @ctrl/base.model.layout | base | base.error, base.schema, base.tracing |
| @ctrl/ui.base.components | ui | — |
| @ctrl/ui.base.api | ui | arch.contract.event-bus, base.event |
| @ctrl/ui.feature.workspace | ui.feature | base.schema, ui.base.api |
| @ctrl/ui.feature.sidebar | ui.feature | base.event, base.schema, base.tracing, base.type, feature.system.settings, ui.base.api, ui.base.components |
| @ctrl/ui.feature.webview | ui.feature | — |
| @ctrl/ui.feature.keyboard-provider | ui.feature | base.schema, ui.base.api |
| @ctrl/ui.feature.terminal | ui.feature | — |
| @ctrl/ui.scene.main | ui.scene | base.schema, base.type, ui.base.api, ui.base.components, ui.feature.keyboard-provider, ui.feature.sidebar, ui.feature.webview, ui.feature.workspace |
| @ctrl/arch.util.spec-builder | unknown | arch.contract.spec |
| @ctrl/arch.impl.terminal | unknown | arch.contract.terminal |
| @ctrl/arch.util.mcp | unknown | arch.contract.event-bus |
| @ctrl/feature.system.settings | unknown | base.event, base.schema, base.tracing |
| @ctrl/arch.impl.spec-registry | unknown | arch.contract.event-bus, arch.contract.spec, arch.contract.spec-registry, arch.contract.spec-runner |
| @ctrl/arch.impl.db | unknown | — |
| @ctrl/arch.contract.spec | unknown | — |
| @ctrl/arch.impl.state-sync | unknown | arch.contract.state-sync |
| @ctrl/feature.terminal.pty | unknown | arch.contract.terminal, base.error, base.tracing |
| @ctrl/feature.workspace.layout | unknown | base.model.layout, base.schema, base.tracing |
| @ctrl/feature.browser.navigation | unknown | — |
| @ctrl/arch.impl.spec-runner | unknown | arch.contract.event-bus, arch.contract.feature-registry, arch.contract.spec, arch.contract.spec-runner |
| @ctrl/arch.contract.state-sync | unknown | — |
| @ctrl/feature.browser.session | unknown | base.error, base.model.session, base.schema, base.tracing, base.type |
| @ctrl/arch.contract.terminal | unknown | — |
| @ctrl/arch.contract.spec-registry | unknown | arch.contract.spec |
| @ctrl/arch.util.otel | unknown | — |
| @ctrl/arch.contract.event-bus | unknown | — |
| @ctrl/arch.contract.spec-runner | unknown | arch.contract.spec |
| @ctrl/feature.browser.history | unknown | base.model.history |
| @ctrl/arch.impl.event-bus | unknown | arch.contract.event-bus |
| @ctrl/arch.impl.ipc-bridge | unknown | arch.contract.event-bus |
| @ctrl/arch.impl.feature-registry | unknown | arch.contract.feature-registry |
| @ctrl/arch.contract.feature-registry | unknown | — |
| @ctrl/wire.desktop.main | wire.desktop | arch.contract.event-bus, arch.contract.feature-registry, arch.contract.spec-registry, arch.contract.spec-runner, arch.contract.state-sync, arch.impl.db, arch.impl.event-bus, arch.impl.feature-registry, arch.impl.ipc-bridge, arch.impl.spec-registry, arch.impl.spec-runner, arch.impl.state-sync, arch.util.mcp, arch.util.otel, base.event, base.model.layout, base.model.session, base.spec.web-session, feature.browser.history, feature.browser.navigation, feature.browser.session, feature.system.settings, feature.workspace.layout |
| @ctrl/wire.desktop.ui | wire.desktop | arch.impl.event-bus, arch.impl.ipc-bridge, arch.util.otel |
| @ctrl/wire.desktop.test | wire.desktop | arch.contract.event-bus, arch.contract.feature-registry, arch.contract.spec-registry, arch.contract.spec-runner, arch.impl.event-bus, arch.impl.feature-registry, arch.impl.spec-registry, arch.impl.spec-runner, base.spec.web-session |

## Services (15)

| Service | Package | Requires | Methods |
|---------|---------|----------|---------|
| HistoryRepository | @ctrl/base.model.history | — | getAll, record, clear |
| SessionRepository | @ctrl/base.model.session | — | getAll, getById, create, remove, setActive, updateCurrentIndex, addPage, removePagesAfterIndex, updatePageTitle, updatePageUrl |
| BookmarkRepository | @ctrl/base.model.bookmark | — | getAll, create, remove, findByUrl |
| LayoutRepository | @ctrl/base.model.layout | — | getLayout, saveLayout |
| StateSync | @ctrl/arch.contract.state-sync | — | register, getSnapshot |
| TerminalPort | @ctrl/arch.contract.terminal | — | spawn, write, resize, close, output |
| SpecRegistry | @ctrl/arch.contract.spec-registry | — | register, describe |
| EventBus | @ctrl/arch.contract.event-bus | — | send, publish, commands, events, on, journal |
| SpecRunner | @ctrl/arch.contract.spec-runner | — | spawn, destroy, dispatch |
| SpecRunnerInternal | @ctrl/arch.contract.spec-runner | — | registerSpec |
| FeatureRegistry | @ctrl/arch.contract.feature-registry | — | register, registerAll, execute, has |
| SettingsFeature | @ctrl/feature.system.settings | — | getShortcuts |
| TerminalFeature | @ctrl/feature.terminal.pty | TerminalPort | create, resize, close, list |
| LayoutFeature | @ctrl/feature.workspace.layout | LayoutRepository | getLayout, getPersistedLayout, updateLayout |
| SessionFeature | @ctrl/feature.browser.session | SessionRepository | getAll, create, remove, navigate, goBack, goForward, setActive, updateTitle, updateUrl |

## Event Catalog (0)

| Event/Command | Payload | Response |
|--------------|---------|----------|

## Layer Graph (19)

- **TerminalAdapterLive** provides TerminalAdapter, no dependencies
- **WorkspaceServiceLive** provides WorkspaceService, requires [EventBus, StateSync, LayoutFeature, SessionFeature]
- **SystemServiceLive** provides SystemService, requires [EventBus, StateSync, SettingsFeature]
- **IdentityLive** provides Identity, no dependencies
- **BrowserDomainLive** provides BrowserDomain, requires [FeatureRegistry, SpecRegistry, StateSync, SessionFeature, SpecRunner, EventBus]
- **AutoStateSyncLive** provides AutoStateSync, requires [StateSync, EventBus]
- **HistoryRepositoryLive** provides HistoryRepository, no dependencies
- **SessionRepositoryLive** provides SessionRepository, no dependencies
- **IpcBridgeLive** provides IpcBridge, requires [EventBus]
- **BookmarkRepositoryLive** provides BookmarkRepository, no dependencies
- **FeatureRegistryLive** provides FeatureRegistry, no dependencies
- **LayoutRepositoryLive** provides LayoutRepository, no dependencies
- **McpServerLive** provides McpServer, requires [EventBus]
- **SettingsFeatureLive** provides SettingsFeature, no dependencies
- **StateSyncLive** provides StateSync, no dependencies
- **TerminalFeatureLive** provides TerminalFeature, requires [TerminalPort]
- **LayoutFeatureLive** provides LayoutFeature, requires [LayoutRepository]
- **SessionFeatureLive** provides SessionFeature, requires [SessionRepository]
- **EventBusLive** provides EventBus, no dependencies

