import type { BrowsingState } from "@ctrl/base.schema";
import {
	type AppCommand,
	BookmarkEvents,
	EventBus,
	NavigationEvents,
	SessionEvents,
	SystemEvents,
	UIEvents,
	WorkspaceEvents,
} from "@ctrl/core.contract.event-bus";
import { BookmarkFeature } from "@ctrl/domain.feature.bookmark";
import { HistoryFeature } from "@ctrl/domain.feature.history";
import { LayoutFeature } from "@ctrl/domain.feature.layout";
import { OmniboxFeature } from "@ctrl/domain.feature.omnibox";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { EventLog } from "@effect/experimental";
import { Cause, Effect, Layer, Stream } from "effect";
import { BROWSING_SERVICE } from "../lib/constants";

// -- EventLog.group() handlers — exhaustive, typed from EventGroup ------------

export const SessionHandlers = EventLog.group(SessionEvents, (h) =>
	h
		.handle("session.create", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				const session = yield* sessions.create(payload.mode);
				yield* sessions.setActive(session.id);
				return session;
			}),
		)
		.handle("session.close", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				yield* sessions.remove(payload.id);
			}),
		)
		.handle("session.activate", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				yield* sessions.setActive(payload.id);
			}),
		),
);

export const NavigationHandlers = EventLog.group(NavigationEvents, (h) =>
	h
		.handle("nav.navigate", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				const omnibox = yield* OmniboxFeature;
				const history = yield* HistoryFeature;
				const { url, query } = yield* omnibox.resolve(payload.input);
				const session = yield* sessions.navigate(payload.id, url);
				yield* history.record(url, null, query).pipe(Effect.ignore);
				return session;
			}),
		)
		.handle("nav.back", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				return yield* sessions.goBack(payload.id);
			}),
		)
		.handle("nav.forward", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				return yield* sessions.goForward(payload.id);
			}),
		)
		.handle("nav.report", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				const history = yield* HistoryFeature;
				yield* sessions.updateUrl(payload.id, payload.url);
				yield* history.record(payload.url, null, null).pipe(Effect.ignore);
			}),
		)
		.handle("nav.update-title", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				yield* sessions.updateTitle(payload.id, payload.title);
			}),
		),
);

export const BookmarkHandlers = EventLog.group(BookmarkEvents, (h) =>
	h
		.handle("bm.add", ({ payload }) =>
			Effect.gen(function* () {
				const bookmarks = yield* BookmarkFeature;
				return yield* bookmarks.create(payload.url, payload.title);
			}),
		)
		.handle("bm.remove", ({ payload }) =>
			Effect.gen(function* () {
				const bookmarks = yield* BookmarkFeature;
				yield* bookmarks.remove(payload.id);
			}),
		),
);

// -- System + UI EventLog handlers --------------------------------------------

export const SystemHandlers = EventLog.group(SystemEvents, (h) =>
	h
		.handle("state.request", () => publishSnapshot)
		.handle("state.snapshot", () => Effect.void)
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
		.handle("diag.pong", () => Effect.void),
);

export const UIHandlers = EventLog.group(UIEvents, (h) =>
	h.handle("ui.toggle-omnibox", () => Effect.void).handle("ui.toggle-sidebar", () => Effect.void),
);

// -- Snapshot publishing ------------------------------------------------------

const publishSnapshot = Effect.gen(function* () {
	const bus = yield* EventBus;
	const sessions = yield* SessionFeature;
	const bookmarks = yield* BookmarkFeature;
	const history = yield* HistoryFeature;
	const layout = yield* LayoutFeature;
	const [s, b, h, l] = yield* Effect.all([
		sessions.getAll(),
		bookmarks.getAll(),
		history.getAll(),
		layout.getLayout().pipe(
			Effect.map((node) => ({ version: 1, dockviewState: node as unknown })),
			Effect.catchAll(() => Effect.succeed(undefined)),
		),
	]);
	yield* bus.publish({
		type: "event",
		name: SystemEvents.events["state.snapshot"].tag,
		payload: { sessions: s, bookmarks: b, history: h, layout: l } satisfies BrowsingState,
		timestamp: Date.now(),
	});
});

// -- Commands that trigger snapshot -------------------------------------------

const MUTATION_ACTIONS: Set<string> = new Set([
	SessionEvents.events["session.create"].tag,
	SessionEvents.events["session.close"].tag,
	SessionEvents.events["session.activate"].tag,
	NavigationEvents.events["nav.navigate"].tag,
	NavigationEvents.events["nav.back"].tag,
	NavigationEvents.events["nav.forward"].tag,
	NavigationEvents.events["nav.report"].tag,
	NavigationEvents.events["nav.update-title"].tag,
	BookmarkEvents.events["bm.add"].tag,
	BookmarkEvents.events["bm.remove"].tag,
	WorkspaceEvents.events["ws.split-panel"].tag,
	WorkspaceEvents.events["ws.move-panel"].tag,
	WorkspaceEvents.events["ws.close-panel"].tag,
]);

// -- BrowsingServiceLive — bridges EventBus commands to EventLog dispatch -----

export const BrowsingServiceLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;
		const client = yield* EventLog.makeClient(
			EventLog.schema(
				SessionEvents,
				NavigationEvents,
				BookmarkEvents,
				WorkspaceEvents,
				UIEvents,
				SystemEvents,
			),
		);

		yield* bus.commands.pipe(
			Stream.runForEach((cmd: AppCommand) => {
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
							console.error(`[${BROWSING_SERVICE}] ${action}:`, Cause.pretty(cause));
						}
						return Effect.void;
					}),
				);

				if (MUTATION_ACTIONS.has(action)) {
					return effect.pipe(Effect.andThen(publishSnapshot));
				}
				return effect;
			}),
			Effect.forkScoped,
		);

		// Publish initial state snapshot
		yield* publishSnapshot;

		console.info(`[bun] ${BROWSING_SERVICE} started`);
	}),
);
