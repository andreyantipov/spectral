import { AppEvents } from "@ctrl/core.contract.event-bus";
import {
	BookmarkRepositoryLive,
	HistoryRepositoryLive,
	LayoutRepositoryLive,
	makeDbClient,
	SessionRepositoryLive,
} from "@ctrl/core.impl.db";
import { EventBusLive } from "@ctrl/core.impl.event-bus";
import { type ElectrobunIpcHandle, IpcBridgeLive } from "@ctrl/core.impl.ipc-bridge";
import { OTEL_SERVICE_NAMES, OtelLive } from "@ctrl/core.middleware.otel";
import { BookmarkFeatureLive } from "@ctrl/domain.feature.bookmark";
import { HistoryFeatureLive } from "@ctrl/domain.feature.history";
import { LayoutFeatureLive } from "@ctrl/domain.feature.layout";
import { OmniboxFeatureLive } from "@ctrl/domain.feature.omnibox";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import { SettingsFeatureLive } from "@ctrl/domain.feature.settings";
import {
	BookmarkHandlers,
	NavigationHandlers,
	SessionHandlers,
	WebBrowsingServiceLive,
} from "@ctrl/domain.service.browsing";
import {
	SettingsHandlers,
	SystemHandlers,
	SystemServiceLive,
	UIHandlers,
} from "@ctrl/domain.service.system";
import { WorkspaceHandlers, WorkspaceServiceLive } from "@ctrl/domain.service.workspace";
import { EventJournal, EventLog } from "@effect/experimental";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { Effect, Layer } from "effect";

// -- Storage: Drizzle ORM + repositories --------------------------------------

const DrizzleLive = drizzleLayer;

const SessionRepositoryLayer = SessionRepositoryLive.pipe(Layer.provide(DrizzleLive));
const BookmarkRepositoryLayer = BookmarkRepositoryLive.pipe(Layer.provide(DrizzleLive));
const HistoryRepositoryLayer = HistoryRepositoryLive.pipe(Layer.provide(DrizzleLive));
const LayoutRepositoryLayer = LayoutRepositoryLive.pipe(Layer.provide(DrizzleLive));

// -- Features -----------------------------------------------------------------

const SessionFeatureLayer = SessionFeatureLive.pipe(Layer.provide(SessionRepositoryLayer));
const BookmarkFeatureLayer = BookmarkFeatureLive.pipe(Layer.provide(BookmarkRepositoryLayer));
const HistoryFeatureLayer = HistoryFeatureLive.pipe(Layer.provide(HistoryRepositoryLayer));
const LayoutFeatureLayer = LayoutFeatureLive.pipe(Layer.provide(LayoutRepositoryLayer));

// -- EventLog: typed handlers + in-memory journal -----------------------------

const IdentityLive = Layer.effect(
	EventLog.Identity,
	Effect.sync(() => EventLog.Identity.makeRandom()),
);
const JournalLive = EventJournal.layerMemory;

// Browsing handlers (session, navigation, bookmark)
const BrowsingHandlersLive = Layer.mergeAll(
	SessionHandlers.pipe(Layer.provide(SessionFeatureLayer)),
	NavigationHandlers.pipe(
		Layer.provide(SessionFeatureLayer),
		Layer.provide(OmniboxFeatureLive),
		Layer.provide(HistoryFeatureLayer),
		Layer.provide(EventBusLive),
	),
	BookmarkHandlers.pipe(Layer.provide(BookmarkFeatureLayer)),
);

// Workspace handlers
const WorkspaceHandlersLive = WorkspaceHandlers.pipe(Layer.provide(LayoutFeatureLayer));

// System handlers (system, UI, settings)
const SystemHandlersLive = Layer.mergeAll(
	SystemHandlers.pipe(Layer.provide(EventBusLive)),
	UIHandlers,
	SettingsHandlers.pipe(Layer.provide(SettingsFeatureLive)),
);

const HandlersLive = Layer.mergeAll(
	BrowsingHandlersLive,
	WorkspaceHandlersLive,
	SystemHandlersLive,
);

const EventLogLive = EventLog.layer(AppEvents).pipe(
	Layer.provide(HandlersLive),
	Layer.provide(JournalLive),
	Layer.provide(IdentityLive),
);

// -- Services -----------------------------------------------------------------

const BrowsingServiceLayer = WebBrowsingServiceLive.pipe(
	Layer.provide(EventLogLive),
	Layer.provide(SessionFeatureLayer),
	Layer.provide(BookmarkFeatureLayer),
	Layer.provide(HistoryFeatureLayer),
	Layer.provide(OmniboxFeatureLive),
	Layer.provide(EventBusLive),
);

const WorkspaceServiceLayer = WorkspaceServiceLive.pipe(
	Layer.provide(EventLogLive),
	Layer.provide(LayoutFeatureLayer),
	Layer.provide(EventBusLive),
);

const SystemServiceLayer = SystemServiceLive.pipe(
	Layer.provide(EventLogLive),
	Layer.provide(EventBusLive),
	Layer.provide(SettingsFeatureLive),
);

// -- Compose ------------------------------------------------------------------

export { ensureSchema } from "@ctrl/core.impl.db";
export type { ElectrobunIpcHandle };

/**
 * Create the main-process layer with IPC bridge to webview.
 * Accepts the app-specific DB file path and the Electrobun IPC handle.
 * Composes OTEL, DB client, all features, services, and the IPC bridge.
 */
export const createMainProcess = (handle: ElectrobunIpcHandle, dbPath: string) => {
	const DbClientLive = makeDbClient(`file:${dbPath}`);
	const OtelLayer = OtelLive(OTEL_SERVICE_NAMES.main, "node");
	const MainProcessLive = Layer.mergeAll(
		EventBusLive,
		BrowsingServiceLayer,
		WorkspaceServiceLayer,
		SystemServiceLayer,
	);
	return Layer.mergeAll(
		DbClientLive,
		OtelLayer,
		Layer.merge(
			MainProcessLive,
			IpcBridgeLive(handle, "main").pipe(Layer.provide(MainProcessLive)),
		).pipe(Layer.provide(DbClientLive), Layer.provide(OtelLayer)),
	);
};
