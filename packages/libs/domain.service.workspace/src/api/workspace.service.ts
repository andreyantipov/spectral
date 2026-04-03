import { EventBus, WorkspaceEvents } from "@ctrl/core.contract.event-bus";
import { LayoutFeature } from "@ctrl/domain.feature.layout";
import { EventLog } from "@effect/experimental";
import { Cause, Effect, Layer, Stream } from "effect";
import { WORKSPACE_SERVICE } from "../lib/constants";

const WS_MUTATIONS: Set<string> = new Set([
	WorkspaceEvents.events["ws.update-layout"].tag,
	WorkspaceEvents.events["ws.split-panel"].tag,
	WorkspaceEvents.events["ws.move-panel"].tag,
	WorkspaceEvents.events["ws.close-panel"].tag,
	WorkspaceEvents.events["ws.resize"].tag,
	WorkspaceEvents.events["ws.activate-panel"].tag,
	WorkspaceEvents.events["ws.reorder-panel"].tag,
	WorkspaceEvents.events["ws.update-tab-meta"].tag,
	WorkspaceEvents.events["ws.add-panel"].tag,
]);

const publishWorkspaceSnapshot = Effect.gen(function* () {
	const bus = yield* EventBus;
	const layout = yield* LayoutFeature;
	const root = yield* layout.getLayout();
	yield* bus.publish({
		type: "event",
		name: "workspace.snapshot",
		payload: { root },
		timestamp: Date.now(),
	});
});

export const WorkspaceServiceLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;
		const client = yield* EventLog.makeClient(EventLog.schema(WorkspaceEvents));

		yield* bus.commands.pipe(
			Stream.filter((cmd) => cmd.action.startsWith("ws.") || cmd.action === "state.request"),
			Stream.runForEach((cmd) => {
				if (cmd.action === "state.request") {
					return publishWorkspaceSnapshot.pipe(Effect.catchAllCause(() => Effect.void));
				}

				const action = cmd.action;
				const payload = (cmd.payload ?? {}) as Record<string, unknown>;

				const effect = Effect.gen(function* () {
					yield* (client as (tag: string, p: unknown) => Effect.Effect<unknown, unknown>)(
						action,
						payload,
					);
				}).pipe(
					Effect.catchAllCause((cause) => {
						if (Cause.isFailure(cause)) {
							console.error(`[${WORKSPACE_SERVICE}] ${action}:`, Cause.pretty(cause));
						}
						return Effect.void;
					}),
				);

				if (WS_MUTATIONS.has(action)) {
					return effect.pipe(Effect.andThen(publishWorkspaceSnapshot));
				}
				return effect;
			}),
			Effect.forkScoped,
		);

		// Publish initial workspace snapshot
		yield* publishWorkspaceSnapshot;

		console.info(`[bun] ${WORKSPACE_SERVICE} started`);
	}),
);
