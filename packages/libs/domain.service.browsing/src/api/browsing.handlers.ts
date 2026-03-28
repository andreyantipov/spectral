import {
	type AppCommand,
	BookmarkEvents,
	type BrowsingState,
	EventBus,
	NavigationEvents,
	SessionEvents,
	STATE_SNAPSHOT,
} from "@ctrl/core.port.event-bus";
import { BookmarkFeature } from "@ctrl/domain.feature.bookmark";
import { HistoryFeature } from "@ctrl/domain.feature.history";
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

// -- Snapshot publishing ------------------------------------------------------

const publishSnapshot = Effect.gen(function* () {
	const bus = yield* EventBus;
	const sessions = yield* SessionFeature;
	const bookmarks = yield* BookmarkFeature;
	const history = yield* HistoryFeature;
	const [s, b, h] = yield* Effect.all([sessions.getAll(), bookmarks.getAll(), history.getAll()]);
	yield* bus.publish({
		type: "event",
		name: STATE_SNAPSHOT,
		payload: { sessions: s, bookmarks: b, history: h } satisfies BrowsingState,
		timestamp: Date.now(),
	});
});

// -- Commands that trigger snapshot -------------------------------------------

const MUTATION_ACTIONS = new Set([
	"session.create",
	"session.close",
	"session.activate",
	"nav.navigate",
	"nav.back",
	"nav.forward",
	"nav.report",
	"nav.update-title",
	"bm.add",
	"bm.remove",
]);

// -- BrowsingServiceLive — bridges EventBus commands to EventLog dispatch -----

export const BrowsingServiceLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;
		const client = yield* EventLog.makeClient(
			EventLog.schema(SessionEvents, NavigationEvents, BookmarkEvents),
		);

		yield* bus.commands.pipe(
			Stream.runForEach((cmd: AppCommand) => {
				const action = cmd.action;
				const payload = (cmd.payload ?? {}) as Record<string, unknown>;

				const effect = Effect.gen(function* () {
					// Try to dispatch via EventLog typed client
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
