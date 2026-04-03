import {
	BookmarkEvents,
	EventBus,
	NavigationEvents,
	SessionEvents,
} from "@ctrl/core.contract.event-bus";
import { StateSync } from "@ctrl/core.contract.state-sync";
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

// -- WebBrowsingServiceLive — bridges EventBus commands to EventLog dispatch --

export const WebBrowsingServiceLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;
		const client = yield* EventLog.makeClient(
			EventLog.schema(SessionEvents, NavigationEvents, BookmarkEvents),
		);

		const sync = yield* StateSync;
		const sessions = yield* SessionFeature;
		const bookmarks = yield* BookmarkFeature;
		const history = yield* HistoryFeature;
		yield* sync.register("browsing", () =>
			Effect.all([sessions.getAll(), bookmarks.getAll(), history.getAll()]).pipe(
				Effect.map(([s, b, h]) => ({ sessions: s, bookmarks: b, history: h })),
				Effect.catchAll(() => Effect.succeed({ sessions: [], bookmarks: [], history: [] })),
			),
		);

		yield* bus.commands.pipe(
			Stream.filter(
				(cmd) =>
					cmd.action.startsWith("session.") ||
					cmd.action.startsWith("nav.") ||
					cmd.action.startsWith("bm."),
			),
			Stream.runForEach((cmd) => {
				const action = cmd.action;
				const payload = (cmd.payload ?? {}) as Record<string, unknown>;

				return Effect.gen(function* () {
					const result = yield* (
						client as (tag: string, p: unknown) => Effect.Effect<unknown, unknown>
					)(action, payload);

					// Choreography: sync layout panels with sessions
					if (
						action === "session.create" &&
						result &&
						typeof result === "object" &&
						"id" in result
					) {
						const session = result as { id: string };
						const panel = {
							id: session.id,
							type: "session" as const,
							entityId: session.id,
							title: "New Tab",
							icon: null,
						};
						// Add panel to first group — layout auto-created by workspace if empty
						yield* typedSend(bus)("ws.add-panel", { groupId: "__auto__", panel }).pipe(
							Effect.ignore,
						);
					}
					if (action === "session.close" && payload && "id" in payload) {
						yield* typedSend(bus)("ws.close-panel", { panelId: payload.id as string }).pipe(
							Effect.ignore,
						);
					}
					if (action === "session.activate" && payload && "id" in payload) {
						yield* typedSend(bus)("ws.activate-panel", { panelId: payload.id as string }).pipe(
							Effect.ignore,
						);
					}
				}).pipe(
					Effect.catchAllCause((cause) => {
						if (Cause.isFailure(cause)) {
							console.error(`[${WEB_BROWSING_SERVICE}] ${action}:`, Cause.pretty(cause));
						}
						return Effect.void;
					}),
				);
			}),
			Effect.forkScoped,
		);

		// Initial layout sync: if sessions exist but layout is empty, create layout
		const initialSessions = yield* sessions.getAll();
		if (initialSessions.length > 0) {
			const panels = initialSessions.map((s) => ({
				id: s.id,
				type: "session" as const,
				entityId: s.id,
				title: "New Tab",
				icon: null,
			}));
			const activeSession = initialSessions.find((s) => s.isActive);
			yield* typedSend(bus)("ws.update-layout", {
				layout: {
					version: 2,
					root: {
						id: crypto.randomUUID(),
						type: "group",
						panels,
						activePanel: activeSession?.id ?? initialSessions[0]?.id ?? "",
					},
				},
			}).pipe(Effect.ignore);
		}

		console.info(`[bun] ${WEB_BROWSING_SERVICE} started`);
	}),
);
