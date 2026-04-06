import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry";
import { SpecRegistry } from "@ctrl/arch.contract.spec-registry";
import { FeatureRegistryLive } from "@ctrl/arch.impl.feature-registry";
import { SpecRegistryLive } from "@ctrl/arch.impl.spec-registry";
import { SpecRunnerLive } from "@ctrl/arch.impl.spec-runner";
import { WebSessionSpec } from "@ctrl/base.spec.web-session";
import { AppEvents, EventBus, TerminalEvents } from "@ctrl/core.contract.event-bus";
import { StateSync } from "@ctrl/core.contract.state-sync";
import {
	LayoutRepositoryLive,
	makeDbClient,
	SessionRepositoryLive,
} from "@ctrl/core.impl.db";
import { EventBusLive } from "@ctrl/core.impl.event-bus";
import { type ElectrobunIpcHandle, IpcBridgeLive } from "@ctrl/core.impl.ipc-bridge";
import { StateSyncLive } from "@ctrl/core.impl.state-sync";
import { McpServerLive } from "@ctrl/core.middleware.mcp";
import { OTEL_SERVICE_NAMES, OtelLive } from "@ctrl/core.middleware.otel/node";
import { LayoutFeatureLive } from "@ctrl/domain.feature.layout";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import { SettingsFeatureLive } from "@ctrl/domain.feature.settings";
import {
	SettingsHandlers,
	SystemHandlers,
	SystemServiceLive,
	UIHandlers,
} from "@ctrl/domain.service.system";
import { WorkspaceHandlers, WorkspaceServiceLive } from "@ctrl/domain.service.workspace";
import { sessionEffects } from "@ctrl/feature.browser.session";
import { navigationEffects } from "@ctrl/feature.browser.navigation";
import { historyEffects } from "@ctrl/feature.browser.history";
import { EventJournal, EventLog } from "@effect/experimental";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { Effect, Layer, Stream } from "effect";

// -- Storage: Drizzle ORM + repositories --------------------------------------

const DrizzleLive = drizzleLayer;

const SessionRepositoryLayer = SessionRepositoryLive.pipe(Layer.provide(DrizzleLive));
const LayoutRepositoryLayer = LayoutRepositoryLive.pipe(Layer.provide(DrizzleLive));

// -- Features (legacy — workspace/system still use old feature layers) --------

const SessionFeatureLayer = SessionFeatureLive.pipe(Layer.provide(SessionRepositoryLayer));
const LayoutFeatureLayer = LayoutFeatureLive.pipe(Layer.provide(LayoutRepositoryLayer));

// -- EventLog: typed handlers + in-memory journal -----------------------------

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

// Workspace handlers
const WorkspaceHandlersLive = WorkspaceHandlers.pipe(Layer.provide(LayoutFeatureLayer));

// System handlers (system, UI, settings)
const SystemHandlersLive = Layer.mergeAll(
	SystemHandlers.pipe(Layer.provide(EventBusLive)),
	UIHandlers,
	SettingsHandlers.pipe(Layer.provide(SettingsFeatureLive)),
	TerminalHandlers,
);

const HandlersLive = Layer.mergeAll(
	WorkspaceHandlersLive,
	SystemHandlersLive,
);

const EventLogLive = EventLog.layer(AppEvents).pipe(
	Layer.provide(HandlersLive),
	Layer.provide(JournalLive),
	Layer.provide(IdentityLive),
);

// -- FSM Spec Engine ----------------------------------------------------------

// SpecRunnerLive needs: FeatureRegistry + EventJournal
// SpecRegistryLive needs: SpecRunnerInternal + EventBus
// FeatureRegistryLive is standalone

// Step 1: FeatureRegistry (no deps)
// Step 2: SpecRunner (needs FeatureRegistry + EventJournal from JournalLive)
// Step 3: SpecRegistry (needs SpecRunnerInternal from SpecRunnerLive + EventBus from SharedLive)
const SpecEngineLive = SpecRegistryLive.pipe(
	Layer.provide(SpecRunnerLive),
	Layer.provide(FeatureRegistryLive),
	Layer.provide(JournalLive),
	// EventBus provided by SharedLive in createMainProcess
);

// Register browser features and the WebSession spec via FeatureRegistry + SpecRegistry.
// sessionEffects and historyEffects need SqliteDrizzle (provided via DrizzleLive).
// navigationEffects is Effect.succeed (no deps).
const BrowserDomainLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const featureReg = yield* FeatureRegistry;
		const specReg = yield* SpecRegistry;

		// Register all feature effect handlers
		yield* featureReg.registerAll(yield* sessionEffects);
		yield* featureReg.registerAll(yield* navigationEffects);
		yield* featureReg.registerAll(yield* historyEffects);

		// Register spec — auto-routing kicks in via SpecRegistry EventBus subscription
		yield* specReg.register(WebSessionSpec);
	}),
).pipe(
	Layer.provide(SpecEngineLive),
	Layer.provide(DrizzleLive),
	// EventBus provided by SharedLive in createMainProcess
);

// -- Services -----------------------------------------------------------------

// Services get EventBusLive + StateSyncLive from SharedLive (provided in createMainProcess)
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
		BrowserDomainLive,
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

// -- Terminal Service (activate after UI rework PR merges) --------------------
// Replace the stub TerminalHandlers above with:
//
//   import { TerminalAdapterLive } from "@ctrl/core.impl.terminal";
//   import { TerminalFeatureLive } from "@ctrl/domain.feature.terminal";
//   import { TerminalHandlers as RealTerminalHandlers } from "@ctrl/domain.service.terminal";
//
//   const TerminalFeatureLayer = TerminalFeatureLive.pipe(
//     Layer.provide(TerminalAdapterLive),
//   );
//
//   // In HandlersLive, replace stub with:
//   RealTerminalHandlers.pipe(Layer.provide(TerminalFeatureLayer)),
//
//   // Add to MUTATION_ACTIONS in browsing.handlers.ts:
//   TerminalEvents.events["term.create"].tag,
//   TerminalEvents.events["term.close"].tag,
