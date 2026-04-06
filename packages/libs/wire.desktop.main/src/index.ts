import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry";
import { SpecRegistry } from "@ctrl/arch.contract.spec-registry";
import { SpecRunner } from "@ctrl/arch.contract.spec-runner";
import { FeatureRegistryLive } from "@ctrl/arch.impl.feature-registry";
import { SpecRegistryLive } from "@ctrl/arch.impl.spec-registry";
import { SpecRunnerLive, SpecRunnerPublicLive } from "@ctrl/arch.impl.spec-runner";
import { WebSession } from "@ctrl/base.spec.web-session";
import { EventBus } from "@ctrl/arch.contract.event-bus";
import {
	AppEvents,
	AUTO_GROUP,
	SettingsEvents,
	STATE_SYNC_EVENT,
	SystemEvents,
	TerminalEvents,
	UI_READY_ACTION,
	UIEvents,
	WorkspaceEvents,
} from "@ctrl/base.event";
import { StateSync } from "@ctrl/arch.contract.state-sync";
import { makeDbClient } from "@ctrl/arch.impl.db";
import { LayoutRepositoryLive } from "@ctrl/base.model.layout";
import { SessionRepositoryLive } from "@ctrl/base.model.session";
import { EventBusLive } from "@ctrl/arch.impl.event-bus";
import { type ElectrobunIpcHandle, IpcBridgeLive } from "@ctrl/arch.impl.ipc-bridge";
import { StateSyncLive } from "@ctrl/arch.impl.state-sync";
import { McpServerLive } from "@ctrl/arch.util.mcp";
import { OTEL_SERVICE_NAMES, OtelLive } from "@ctrl/arch.util.otel/node";
import { historyEffects } from "@ctrl/feature.browser.history";
import { navigationEffects } from "@ctrl/feature.browser.navigation";
import { SessionFeature, SessionFeatureLive, sessionEffects } from "@ctrl/feature.browser.session";
import { SettingsFeature, SettingsFeatureLive } from "@ctrl/feature.system.settings";
import {
	findAndActivatePanel,
	findAndMovePanel,
	findAndRemovePanel,
	findAndReorderPanel,
	findAndResize,
	findAndSplitPanel,
	findAndUpdateTabMeta,
	findFirstGroupId,
	insertPanelIntoGroup,
	LayoutFeature,
	LayoutFeatureLive,
} from "@ctrl/feature.workspace.layout";
import { EventJournal, EventLog } from "@effect/experimental";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { Cause, Effect, Layer, Stream } from "effect";

// -- Storage: Drizzle ORM + repositories --------------------------------------

const DrizzleLive = drizzleLayer;

const SessionRepositoryLayer = SessionRepositoryLive.pipe(Layer.provide(DrizzleLive));
const LayoutRepositoryLayer = LayoutRepositoryLive.pipe(Layer.provide(DrizzleLive));

// -- Features (legacy — workspace/system still use old feature layers) --------

const SessionFeatureLayer = SessionFeatureLive.pipe(Layer.provide(SessionRepositoryLayer));
const LayoutFeatureLayer = LayoutFeatureLive.pipe(Layer.provide(LayoutRepositoryLayer));

// -- EventLog: typed handlers + in-memory journal -----------------------------

// -- Workspace handlers (inlined from domain.service.workspace) ---------------

const WORKSPACE_SERVICE = "WorkspaceService" as const;

const WorkspaceHandlers = EventLog.group(WorkspaceEvents, (h) =>
	h
		.handle("ws.update-layout", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				yield* layout.updateLayout(payload.layout);
			}),
		)
		.handle("ws.split-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndSplitPanel(
					current,
					payload.panelId,
					payload.direction,
					payload.newPanel,
				);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.move-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const { node: stripped, panel } = findAndMovePanel(current, payload.panelId);
				if (!panel || !stripped) return;
				const updated = insertPanelIntoGroup(stripped, payload.targetGroupId, panel);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.close-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const { node } = findAndRemovePanel(current, payload.panelId);
				if (!node) return;
				yield* layout.updateLayout({ version: 2, root: node });
			}),
		)
		.handle("ws.resize", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndResize(current, payload.splitId, payload.sizes);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.activate-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndActivatePanel(current, payload.panelId);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.reorder-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndReorderPanel(
					current,
					payload.groupId,
					payload.panelId,
					payload.index,
				);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.add-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				let groupId = payload.groupId;
				if (groupId === AUTO_GROUP) {
					groupId = findFirstGroupId(current) ?? current.id;
				}
				const updated = insertPanelIntoGroup(current, groupId, payload.panel);
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		)
		.handle("ws.update-tab-meta", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndUpdateTabMeta(current, payload.panelId, {
					title: payload.title,
					icon: payload.icon,
				});
				yield* layout.updateLayout({ version: 2, root: updated });
			}),
		),
);

const WorkspaceServiceLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;
		const client = yield* EventLog.makeClient(EventLog.schema(WorkspaceEvents));

		const sync = yield* StateSync;
		const layout = yield* LayoutFeature;
		const sessions = yield* SessionFeature;
		yield* sync.register("workspace", () =>
			Effect.gen(function* () {
				let root = yield* layout.getLayout();
				if (root && root.type === "group" && root.panels.length === 0) {
					const allSessions = yield* sessions.getAll();
					if (allSessions.length > 0) {
						const panels = allSessions.map((s) => ({
							id: s.id,
							type: "session" as const,
							entityId: s.id,
							title: "New Tab",
							icon: null,
						}));
						const active = allSessions.find((s) => s.isActive);
						root = { ...root, panels, activePanel: active?.id ?? allSessions[0]?.id ?? "" };
						yield* layout.updateLayout({ version: 2, root });
					}
				}
				return { root };
			}).pipe(Effect.catchAll(() => Effect.succeed({ root: null }))),
		);

		yield* bus.commands.pipe(
			Stream.filter((cmd) => cmd.action.startsWith("ws.")),
			Stream.runForEach((cmd) => {
				const action = cmd.action;
				const payload = (cmd.payload ?? {}) as Record<string, unknown>;

				return Effect.gen(function* () {
					yield* Effect.logDebug(`[${WORKSPACE_SERVICE}] received: ${action}`);
					yield* (client as (tag: string, p: unknown) => Effect.Effect<unknown, unknown>)(
						action,
						payload,
					);
				}).pipe(
					Effect.catchAllCause((cause) => {
						if (Cause.isFailure(cause)) {
							return Effect.logError(`[${WORKSPACE_SERVICE}] ${action}: ${Cause.pretty(cause)}`);
						}
						return Effect.void;
					}),
				);
			}),
			Effect.forkScoped,
		);

		yield* Effect.logInfo(`${WORKSPACE_SERVICE} started`);
	}),
);

// -- System handlers (inlined from domain.service.system) ---------------------

const SYSTEM_SERVICE = "SystemService" as const;

const SystemHandlers = EventLog.group(SystemEvents, (h) =>
	h
		.handle("diag.ping", () =>
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* bus.publish({
					type: "event",
					name: SystemEvents.events["diag.pong"].tag,
					payload: { message: "EventBus alive" },
					timestamp: Date.now(),
				});
			}),
		)
		.handle("diag.pong", () => Effect.void)
		.handle("diag.eval-js", ({ payload }) =>
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* bus.publish({
					type: "event",
					name: "diag.eval-js-request",
					payload,
					timestamp: Date.now(),
				});
			}),
		)
		.handle("diag.eval-js-result", ({ payload }) =>
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* bus.publish({
					type: "event",
					name: "diag.eval-js-result",
					payload,
					timestamp: Date.now(),
				});
			}),
		)
		.handle("diag.screenshot", () =>
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* bus.publish({
					type: "event",
					name: "diag.screenshot-request",
					payload: {},
					timestamp: Date.now(),
				});
			}),
		)
		.handle("diag.screenshot-result", ({ payload }) =>
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* bus.publish({
					type: "event",
					name: "diag.screenshot-result",
					payload,
					timestamp: Date.now(),
				});
			}),
		),
);

const UIHandlers = EventLog.group(UIEvents, (h) =>
	h.handle("ui.toggle-omnibox", () => Effect.void).handle("ui.toggle-sidebar", () => Effect.void),
);

const SettingsHandlers = EventLog.group(SettingsEvents, (h) =>
	h.handle("settings.shortcuts", () =>
		Effect.gen(function* () {
			const feature = yield* SettingsFeature;
			return yield* feature.getShortcuts();
		}),
	),
);

const SystemServiceLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;
		const client = yield* EventLog.makeClient(
			EventLog.schema(SystemEvents, UIEvents, SettingsEvents),
		);

		const sync = yield* StateSync;
		const settings = yield* SettingsFeature;
		yield* sync.register("settings", () =>
			settings.getShortcuts().pipe(Effect.map((shortcuts) => ({ shortcuts }))),
		);

		yield* bus.commands.pipe(
			Stream.filter(
				(cmd) =>
					cmd.action.startsWith("diag.") ||
					cmd.action.startsWith("ui.") ||
					cmd.action.startsWith("settings."),
			),
			Stream.runForEach((cmd) => {
				const action = cmd.action;
				const payload = (cmd.payload ?? {}) as Record<string, unknown>;

				return Effect.gen(function* () {
					yield* (client as (tag: string, p: unknown) => Effect.Effect<unknown, unknown>)(
						action,
						payload,
					);
				}).pipe(
					Effect.catchAllCause((cause) => {
						if (Cause.isFailure(cause)) {
							return Effect.logError(`[${SYSTEM_SERVICE}] ${action}: ${Cause.pretty(cause)}`);
						}
						return Effect.void;
					}),
				);
			}),
			Effect.forkScoped,
		);

		yield* Effect.logInfo(`${SYSTEM_SERVICE} started`);
	}),
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

// Workspace handlers
const WorkspaceHandlersLive = WorkspaceHandlers.pipe(Layer.provide(LayoutFeatureLayer));

// System handlers (system, UI, settings)
const SystemHandlersLive = Layer.mergeAll(
	SystemHandlers.pipe(Layer.provide(EventBusLive)),
	UIHandlers,
	SettingsHandlers.pipe(Layer.provide(SettingsFeatureLive)),
	TerminalHandlers,
);

const HandlersLive = Layer.mergeAll(WorkspaceHandlersLive, SystemHandlersLive);

const EventLogLive = EventLog.layer(AppEvents).pipe(
	Layer.provide(HandlersLive),
	Layer.provide(JournalLive),
	Layer.provide(IdentityLive),
);

// -- FSM Spec Engine ----------------------------------------------------------

// SpecEngineLive — same pattern as wire.desktop.test/TestSpecEngineWithBusLive
const SpecInfraLayer = Layer.mergeAll(EventBusLive, FeatureRegistryLive);
const SpecRunnerLayer = SpecRunnerLive.pipe(Layer.provide(SpecInfraLayer));
const SpecRegistryLayer = SpecRegistryLive.pipe(
	Layer.provide(SpecRunnerLayer),
	Layer.provide(SpecInfraLayer),
);
const SpecRunnerPublicLayer = SpecRunnerPublicLive.pipe(Layer.provide(SpecRunnerLayer));
const SpecEngineLive = Layer.mergeAll(SpecRegistryLayer, SpecRunnerPublicLayer, SpecInfraLayer);

// BrowserDomainLive:
// 1. Registers features (effects) in FeatureRegistry
// 2. Registers WebSession in SpecRegistry (auto-routing kicks in)
// 3. Registers browsing snapshot provider in StateSync (UI reads this)
// 4. Restores existing DB sessions as FSM instances
const BrowserDomainLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const featureReg = yield* FeatureRegistry;
		const specReg = yield* SpecRegistry;
		const sync = yield* StateSync;
		const sessionFeature = yield* SessionFeature;
		const runner = yield* SpecRunner;
		const bus = yield* EventBus;

		// 1. Register feature effects
		yield* featureReg.registerAll(yield* sessionEffects);
		yield* featureReg.registerAll(yield* navigationEffects);
		yield* featureReg.registerAll(yield* historyEffects);

		// 2. Register browsing snapshot provider for UI state-sync
		yield* sync.register("browsing", () =>
			sessionFeature.getAll().pipe(
				Effect.map((sessions) => ({ sessions, bookmarks: [], history: [] })),
				Effect.catchAll(() => Effect.succeed({ sessions: [], bookmarks: [], history: [] })),
			),
		);

		// 3. Register spec — auto-routing from EventBus
		yield* specReg.register(WebSession);

		// 4. Restore existing sessions from DB as FSM instances + workspace panels
		const sessions = yield* sessionFeature.getAll().pipe(Effect.catchAll(() => Effect.succeed([])));
		for (const session of sessions) {
			yield* runner.spawn("web-session", session.id, { initialState: "Browsing" });
			// Restore workspace panel so webview renders
			yield* bus.send({
				type: "command",
				action: "ws.add-panel",
				payload: {
					groupId: AUTO_GROUP,
					panel: {
						id: session.id,
						type: "session" as const,
						entityId: session.id,
						title: "New Tab",
						icon: null,
					},
				},
				meta: { source: "system" },
			});
		}
		// Activate first session
		if (sessions.length > 0) {
			const active = sessions.find((s) => s.isActive) ?? sessions[0];
			yield* bus.send({
				type: "command",
				action: "ws.activate-panel",
				payload: { panelId: active.id },
				meta: { source: "system" },
			});
		}

		// Choreography: session.create effect dispatches ws.add-panel directly.
		// No bridge needed here — features handle outbound dispatch.
	}),
).pipe(
	Layer.provide(SpecEngineLive),
	Layer.provide(DrizzleLive),
	Layer.provide(SessionFeatureLayer),
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
					if (cmd.action === UI_READY_ACTION) lastJson = "";
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
					name: STATE_SYNC_EVENT,
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

export { ensureSchema } from "@ctrl/arch.impl.db";
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
	).pipe(Layer.provide(SharedLive), Layer.provide(DbClientLive), Layer.provide(FeatureRegistryLive));
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
// Replace the stub TerminalHandlers above with real handlers using:
//   TerminalFeatureLive from @ctrl/feature.terminal.pty
//   TerminalAdapterLive from @ctrl/arch.impl.terminal
