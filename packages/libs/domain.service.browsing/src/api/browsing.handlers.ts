import { withTracing } from "@ctrl/core.shared";
import { BookmarkFeature } from "@ctrl/domain.feature.bookmark";
import { HistoryFeature } from "@ctrl/domain.feature.history";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { Effect, Stream } from "effect";
import { BROWSING_SERVICE } from "../lib/constants";
import type { BrowsingState } from "../model/browsing.events";
import { BrowsingRpcs } from "./browsing.rpc";

export const BrowsingHandlersLive = BrowsingRpcs.toLayer(
	Effect.gen(function* () {
		const sessions = yield* SessionFeature;
		const bookmarks = yield* BookmarkFeature;
		const history = yield* HistoryFeature;

		return withTracing(BROWSING_SERVICE, {
			createSession: ({ mode }: { readonly mode: "visual" }) =>
				sessions.create(mode).pipe(Effect.tap((s) => sessions.setActive(s.id))),
			removeSession: ({ id }: { readonly id: string }) => sessions.remove(id),
			navigate: ({ id, url }: { readonly id: string; readonly url: string }) =>
				sessions
					.navigate(id, url)
					.pipe(Effect.tap(() => history.record(url, null).pipe(Effect.ignore))),
			goBack: ({ id }: { readonly id: string }) => sessions.goBack(id),
			goForward: ({ id }: { readonly id: string }) => sessions.goForward(id),
			getSessions: () => sessions.getAll(),
			setActive: ({ id }: { readonly id: string }) => sessions.setActive(id),
			updateTitle: ({ id, title }: { readonly id: string; readonly title: string }) =>
				sessions.updateTitle(id, title),
			// Bookmark handlers
			getBookmarks: () => bookmarks.getAll(),
			addBookmark: ({ url, title }: { readonly url: string; readonly title: string | null }) =>
				bookmarks.create(url, title),
			removeBookmark: ({ id }: { readonly id: string }) => bookmarks.remove(id),
			isBookmarked: ({ url }: { readonly url: string }) => bookmarks.isBookmarked(url),
			// History handlers
			getHistory: () => history.getAll(),
			clearHistory: () => history.clear(),
			// Combined stream
			browsingChanges: () => {
				const s$ = Stream.concat(
					Stream.fromEffect(sessions.getAll().pipe(Effect.orDie)),
					sessions.changes,
				);
				const b$ = Stream.concat(
					Stream.fromEffect(bookmarks.getAll().pipe(Effect.orDie)),
					bookmarks.changes,
				);
				const h$ = Stream.concat(
					Stream.fromEffect(history.getAll().pipe(Effect.orDie)),
					history.changes,
				);
				return Stream.zipLatest(Stream.zipLatest(s$, b$), h$).pipe(
					Stream.map(
						([[s, b], h]): BrowsingState => ({
							sessions: s,
							bookmarks: b,
							history: h,
						}),
					),
				);
			},
		});
	}),
);
