import type { BrowsingState } from "@ctrl/base.schema";
import {
	BookmarkEvents,
	EventBus,
	NavigationEvents,
	SessionEvents,
} from "@ctrl/core.contract.event-bus";
import { typedSend } from "@ctrl/core.impl.event-bus";
import { BookmarkFeature } from "@ctrl/domain.feature.bookmark";
import { HistoryFeature } from "@ctrl/domain.feature.history";
import { OmniboxFeature } from "@ctrl/domain.feature.omnibox";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { EventLog } from "@effect/experimental";
import { Cause, Effect, Layer, Stream } from "effect";
import { WEB_BROWSING_SERVICE } from "../lib/constants";

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
				const bus = yield* EventBus;
				yield* sessions.setActive(payload.id);
				// Choreography: sync active panel in workspace layout
				typedSend(bus)("ws.activate-panel", { panelId: payload.id });
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

				// Choreography: notify workspace of title changes
				const bus = yield* EventBus;
				yield* typedSend(bus)("ws.update-tab-meta", {
					panelId: payload.id,
					title: payload.title,
					icon: undefined,
				}).pipe(Effect.ignore);
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

// -- Snapshot publishing ------------------------------------------------------

const publishBrowsingSnapshot = Effect.gen(function* () {
	const bus = yield* EventBus;
	const sessions = yield* SessionFeature;
	const bookmarks = yield* BookmarkFeature;
	const history = yield* HistoryFeature;
	const [s, b, h] = yield* Effect.all([sessions.getAll(), bookmarks.getAll(), history.getAll()]);
	yield* bus.publish({
		type: "event",
		name: "browsing.snapshot",
		payload: { sessions: s, bookmarks: b, history: h } satisfies BrowsingState,
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
]);

// -- WebBrowsingServiceLive — bridges EventBus commands to EventLog dispatch --

export const WebBrowsingServiceLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;
		const client = yield* EventLog.makeClient(
			EventLog.schema(SessionEvents, NavigationEvents, BookmarkEvents),
		);

		yield* bus.commands.pipe(
			Stream.filter(
				(cmd) =>
					cmd.action.startsWith("session.") ||
					cmd.action.startsWith("nav.") ||
					cmd.action.startsWith("bm.") ||
					cmd.action === "state.request",
			),
			Stream.runForEach((cmd) => {
				if (cmd.action === "state.request") {
					return publishBrowsingSnapshot.pipe(Effect.catchAllCause(() => Effect.void));
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
							console.error(`[${WEB_BROWSING_SERVICE}] ${action}:`, Cause.pretty(cause));
						}
						return Effect.void;
					}),
				);

				if (MUTATION_ACTIONS.has(action)) {
					return effect.pipe(Effect.andThen(publishBrowsingSnapshot));
				}
				return effect;
			}),
			Effect.forkScoped,
		);

		// Publish initial browsing snapshot
		yield* publishBrowsingSnapshot;

		console.info(`[bun] ${WEB_BROWSING_SERVICE} started`);
	}),
);
