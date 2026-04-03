import { EventBus, WorkspaceEvents } from "@ctrl/core.contract.event-bus";
import { StateSync } from "@ctrl/core.contract.state-sync";
import { LayoutFeature } from "@ctrl/domain.feature.layout";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { EventLog } from "@effect/experimental";
import { Cause, Effect, Layer, Stream } from "effect";
import { WORKSPACE_SERVICE } from "../lib/constants";

export const WorkspaceServiceLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;
		const client = yield* EventLog.makeClient(EventLog.schema(WorkspaceEvents));

		const sync = yield* StateSync;
		const layout = yield* LayoutFeature;
		const sessions = yield* SessionFeature;
		yield* sync.register("workspace", () =>
			Effect.gen(function* () {
				let root = yield* layout.getLayout();
				// Auto-create layout from sessions if empty
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
				console.info(`[WorkspaceService] received: ${cmd.action}`);
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
							console.error(`[${WORKSPACE_SERVICE}] ${action}:`, Cause.pretty(cause));
						}
						return Effect.void;
					}),
				);
			}),
			Effect.forkScoped,
		);

		console.info(`[bun] ${WORKSPACE_SERVICE} started`);
	}),
);
