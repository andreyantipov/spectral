import { AppEvents, EventBus } from "@ctrl/core.contract.event-bus";
import { StateSync } from "@ctrl/core.contract.state-sync";
import {
	BookmarkRepositoryLive,
	HistoryRepositoryLive,
	LayoutRepositoryLive,
	makeDbClient,
	SessionRepositoryLive,
} from "@ctrl/core.impl.db";
import { EventBusLive } from "@ctrl/core.impl.event-bus";
import { type ElectrobunIpcHandle, IpcBridgeLive } from "@ctrl/core.impl.ipc-bridge";
import { StateSyncLive } from "@ctrl/core.impl.state-sync";
import { McpServerLive } from "@ctrl/core.middleware.mcp";
import { OTEL_SERVICE_NAMES, OtelLive } from "@ctrl/core.middleware.otel/node";
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
import { Effect, Layer, Stream } from "effect";

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

// Services get EventBusLive + StateSyncLive from SharedLive (provided in createMainProcess)
const BrowsingServiceLayer = WebBrowsingServiceLive.pipe(
	Layer.provide(EventLogLive),
	Layer.provide(SessionFeatureLayer),
	Layer.provide(BookmarkFeatureLayer),
	Layer.provide(HistoryFeatureLayer),
	Layer.provide(OmniboxFeatureLive),
);

const WorkspaceServiceLayer = WorkspaceServiceLive.pipe(
	Layer.provide(EventLogLive),
	Layer.provide(LayoutFeatureLayer),
	Layer.provide(SessionFeatureLayer),
);

const SystemServiceLayer = SystemServiceLive.pipe(
	Layer.provide(EventLogLive),
	Layer.provide(SettingsFeatureLive),
);

// -- State Sync ---------------------------------------------------------------

const AutoStateSyncLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const sync = yield* StateSync;
		const bus = yield* EventBus;

		let dirty = false; // will be set after initial delay
		let lastJson = "";

		// Mark dirty on any command (but don't publish immediately)
		// ui.ready = webview just mounted and subscribed; force re-publish
		// even if snapshot data hasn't changed (it was published before UI was ready)
		yield* bus.commands.pipe(
			Stream.runForEach((cmd) =>
				Effect.sync(() => {
					dirty = true;
					if (cmd.action === "ui.ready") lastJson = "";
				}),
			),
			Effect.forkScoped,
		);

		// Initial state publish — delay to ensure webview UI has mounted
		yield* Effect.sleep("1500 millis").pipe(
			Effect.andThen(
				Effect.sync(() => {
					dirty = true;
				}),
			),
			Effect.forkScoped,
		);

		// Periodic check: publish only when dirty, deduplicate by JSON equality
		yield* Effect.forever(
			Effect.gen(function* () {
				yield* Effect.sleep("100 millis");
				if (!dirty) return;
				dirty = false;
				const snapshot = yield* sync.getSnapshot().pipe(Effect.catchAll(() => Effect.succeed({})));
				const json = JSON.stringify(snapshot);
				if (json === lastJson) return;
				lastJson = json;
				yield* bus.publish({
					type: "event",
					name: "state-sync",
					payload: snapshot,
					timestamp: Date.now(),
				});
			}).pipe(Effect.catchAllCause(() => Effect.void)),
		).pipe(Effect.forkScoped);
	}),
);

// -- Dev Server ---------------------------------------------------------------

// McpLayer gets EventBusLive and StateSyncLive from MainProcessLive (shared instances)
const _McpLayer = McpServerLive;

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
	const SharedLive = Layer.merge(EventBusLive, StateSyncLive);
	const ServicesLive = Layer.mergeAll(
		BrowsingServiceLayer,
		WorkspaceServiceLayer,
		SystemServiceLayer,
		McpServerLive,
		AutoStateSyncLive,
	).pipe(Layer.provide(SharedLive));
	const MainProcessLive = Layer.merge(SharedLive, ServicesLive);
	return Layer.mergeAll(
		DbClientLive,
		OtelLayer,
		Layer.merge(
			MainProcessLive,
			IpcBridgeLive(handle, "main").pipe(Layer.provide(MainProcessLive)),
		).pipe(Layer.provide(DbClientLive), Layer.provide(OtelLayer)),
	);
};
