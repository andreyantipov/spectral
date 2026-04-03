import { EventBus, SettingsEvents, SystemEvents, UIEvents } from "@ctrl/core.contract.event-bus";
import { StateSync } from "@ctrl/core.contract.state-sync";
import { SettingsFeature } from "@ctrl/domain.feature.settings";
import { EventLog } from "@effect/experimental";
import { Cause, Effect, Layer, Stream } from "effect";
import { SYSTEM_SERVICE } from "../lib/constants";

// -- EventLog.group() handlers ------------------------------------------------

export const SystemHandlers = EventLog.group(SystemEvents, (h) =>
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

export const UIHandlers = EventLog.group(UIEvents, (h) =>
	h.handle("ui.toggle-omnibox", () => Effect.void).handle("ui.toggle-sidebar", () => Effect.void),
);

export const SettingsHandlers = EventLog.group(SettingsEvents, (h) =>
	h.handle("settings.shortcuts", () =>
		Effect.gen(function* () {
			const feature = yield* SettingsFeature;
			return yield* feature.getShortcuts();
		}),
	),
);

// -- SystemServiceLive --------------------------------------------------------

export const SystemServiceLive = Layer.scopedDiscard(
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
							console.error(`[${SYSTEM_SERVICE}] ${action}:`, Cause.pretty(cause));
						}
						return Effect.void;
					}),
				);
			}),
			Effect.forkScoped,
		);

		console.info(`[bun] ${SYSTEM_SERVICE} started`);
	}),
);
