import { AppEvents, SettingsEvents, TerminalEvents } from "@ctrl/core.contract.event-bus";
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
import { SettingsFeature, SettingsFeatureLive } from "@ctrl/domain.feature.settings";
import {
	BookmarkHandlers,
	BrowsingServiceLive,
	NavigationHandlers,
	SessionHandlers,
	SystemHandlers,
	UIHandlers,
} from "@ctrl/domain.service.browsing";
import { WorkspaceHandlers } from "@ctrl/domain.service.workspace";
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

const SettingsHandlers = EventLog.group(SettingsEvents, (h) =>
	h.handle("settings.shortcuts", () =>
		Effect.gen(function* () {
			const feature = yield* SettingsFeature;
			return yield* feature.getShortcuts();
		}),
	),
);

// Stub terminal handlers — real implementation will be wired via domain.service.terminal
const TerminalHandlers = EventLog.group(TerminalEvents, (h) =>
	h
		.handle("term.create", () => Effect.succeed({ id: "stub" }))
		.handle("term.resize", () => Effect.void)
		.handle("term.close", () => Effect.void),
);

const IdentityLive = Layer.effect(
	EventLog.Identity,
	Effect.sync(() => EventLog.Identity.makeRandom()),
);
const JournalLive = EventJournal.layerMemory;

const HandlersLive = Layer.mergeAll(
	SessionHandlers.pipe(Layer.provide(SessionFeatureLayer)),
	NavigationHandlers.pipe(
		Layer.provide(SessionFeatureLayer),
		Layer.provide(OmniboxFeatureLive),
		Layer.provide(HistoryFeatureLayer),
	),
	BookmarkHandlers.pipe(Layer.provide(BookmarkFeatureLayer)),
	WorkspaceHandlers.pipe(Layer.provide(LayoutFeatureLayer)),
	SystemHandlers.pipe(
		Layer.provide(SessionFeatureLayer),
		Layer.provide(BookmarkFeatureLayer),
		Layer.provide(HistoryFeatureLayer),
		Layer.provide(EventBusLive),
	),
	UIHandlers,
	SettingsHandlers.pipe(Layer.provide(SettingsFeatureLive)),
	TerminalHandlers,
);

const EventLogLive = EventLog.layer(AppEvents).pipe(
	Layer.provide(HandlersLive),
	Layer.provide(JournalLive),
	Layer.provide(IdentityLive),
);

// -- Services -----------------------------------------------------------------

const BrowsingServiceLayer = BrowsingServiceLive.pipe(
	Layer.provide(EventLogLive),
	Layer.provide(SessionFeatureLayer),
	Layer.provide(BookmarkFeatureLayer),
	Layer.provide(HistoryFeatureLayer),
	Layer.provide(LayoutFeatureLayer),
	Layer.provide(OmniboxFeatureLive),
	Layer.provide(EventBusLive),
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
	const MainProcessLive = Layer.mergeAll(EventBusLive, BrowsingServiceLayer);
	return Layer.mergeAll(
		DbClientLive,
		OtelLayer,
		Layer.merge(
			MainProcessLive,
			IpcBridgeLive(handle, "main").pipe(Layer.provide(MainProcessLive)),
		).pipe(Layer.provide(DbClientLive), Layer.provide(OtelLayer)),
	);
};
