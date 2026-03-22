import { withServiceSpan } from "@ctrl/core.base.tracing";
import { BookmarkEvents, NavigationEvents, SessionEvents } from "@ctrl/core.port.event-bus";
import { BookmarkFeature } from "@ctrl/domain.feature.bookmark";
import { HistoryFeature } from "@ctrl/domain.feature.history";
import { OmniboxFeature } from "@ctrl/domain.feature.omnibox";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { EventLog } from "@effect/experimental";
import { Effect } from "effect";
import { BROWSING_SERVICE } from "../lib/constants";

const span = (op: string) => withServiceSpan(BROWSING_SERVICE, op);

export const SessionHandlers = EventLog.group(SessionEvents, (h) =>
	h
		.handle("session.create", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				const session = yield* sessions.create(payload.mode);
				yield* sessions.setActive(session.id);
				return session;
			}).pipe(Effect.orDie, span("session.create")),
		)
		.handle("session.close", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				yield* sessions.remove(payload.id);
			}).pipe(Effect.orDie, span("session.close")),
		)
		.handle("session.activate", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				yield* sessions.setActive(payload.id);
			}).pipe(Effect.orDie, span("session.activate")),
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
			}).pipe(Effect.orDie, span("nav.navigate")),
		)
		.handle("nav.back", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				return yield* sessions.goBack(payload.id);
			}).pipe(Effect.orDie, span("nav.back")),
		)
		.handle("nav.forward", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				return yield* sessions.goForward(payload.id);
			}).pipe(Effect.orDie, span("nav.forward")),
		)
		.handle("nav.report", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				const history = yield* HistoryFeature;
				yield* sessions.updateUrl(payload.id, payload.url);
				yield* history.record(payload.url, null, null).pipe(Effect.ignore);
			}).pipe(Effect.orDie, span("nav.report")),
		)
		.handle("nav.update-title", ({ payload }) =>
			Effect.gen(function* () {
				const sessions = yield* SessionFeature;
				yield* sessions.updateTitle(payload.id, payload.title);
			}).pipe(Effect.orDie, span("nav.update-title")),
		),
);

export const BookmarkHandlers = EventLog.group(BookmarkEvents, (h) =>
	h
		.handle("bm.add", ({ payload }) =>
			Effect.gen(function* () {
				const bookmarks = yield* BookmarkFeature;
				return yield* bookmarks.create(payload.url, payload.title);
			}).pipe(Effect.orDie, span("bm.add")),
		)
		.handle("bm.remove", ({ payload }) =>
			Effect.gen(function* () {
				const bookmarks = yield* BookmarkFeature;
				yield* bookmarks.remove(payload.id);
			}).pipe(Effect.orDie, span("bm.remove")),
		),
);
