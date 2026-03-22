import type { Bookmark, HistoryEntry, Page, Session } from "@ctrl/core.base.model";
import { DEFAULT_TAB_URL } from "@ctrl/core.base.types";
import { BookmarkRepository, HistoryRepository, SessionRepository } from "@ctrl/core.shared";
import { type TestSpanExporter, TestSpanExporterLive } from "@ctrl/domain.adapter.otel";
import { BookmarkFeatureLive } from "@ctrl/domain.feature.bookmark";
import { HistoryFeatureLive } from "@ctrl/domain.feature.history";
import { OmniboxFeatureLive } from "@ctrl/domain.feature.omnibox";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import { BrowsingHandlersLive, type BrowsingRpcs } from "@ctrl/domain.service.browsing";
import { Effect, Layer } from "effect";

let nextId = 0;
let sessions: Session[] = [];
let bookmarkNextId = 0;
let storedBookmarks: Bookmark[] = [];
let historyNextId = 0;
let storedHistory: HistoryEntry[] = [];

const makeSession = (mode: "visual"): Session => {
	const id = String(++nextId);
	return {
		id,
		pages: [{ url: DEFAULT_TAB_URL, title: null, loadedAt: new Date().toISOString() }],
		currentIndex: 0,
		mode,
		isActive: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
};

export const MockSessionRepositoryLive = Layer.succeed(SessionRepository, {
	getAll: () => Effect.succeed(sessions),
	getById: (id: string) => Effect.succeed(sessions.find((s) => s.id === id)),
	create: (mode: "visual") =>
		Effect.sync(() => {
			const session = makeSession(mode);
			sessions = [...sessions, session];
			return session;
		}),
	remove: (id: string) =>
		Effect.sync(() => {
			sessions = sessions.filter((s) => s.id !== id);
		}),
	setActive: (_id: string) => Effect.void,
	updateCurrentIndex: (_id: string, _index: number) => Effect.void,
	addPage: (_sessionId: string, url: string, _atIndex: number) =>
		Effect.succeed({
			url,
			title: null,
			loadedAt: new Date().toISOString(),
		} satisfies Page),
	removePagesAfterIndex: (_sessionId: string, _index: number) => Effect.void,
	updatePageTitle: (_sessionId: string, _pageIndex: number, _title: string) => Effect.void,
	updatePageUrl: (_sessionId: string, _pageIndex: number, _url: string) => Effect.void,
});

export const MockBookmarkRepositoryLive = Layer.succeed(BookmarkRepository, {
	getAll: () => Effect.succeed(storedBookmarks),
	create: (url: string, title: string | null) =>
		Effect.sync(() => {
			const bookmark: Bookmark = {
				id: String(++bookmarkNextId),
				url,
				title,
				createdAt: new Date().toISOString(),
			};
			storedBookmarks = [...storedBookmarks, bookmark];
			return bookmark;
		}),
	remove: (id: string) =>
		Effect.sync(() => {
			storedBookmarks = storedBookmarks.filter((b) => b.id !== id);
		}),
	findByUrl: (url: string) => Effect.succeed(storedBookmarks.find((b) => b.url === url)),
});

export const MockHistoryRepositoryLive = Layer.succeed(HistoryRepository, {
	getAll: () => Effect.succeed(storedHistory),
	record: (url: string, title: string | null, query: string | null = null) =>
		Effect.sync(() => {
			const entry: HistoryEntry = {
				id: String(++historyNextId),
				url,
				title,
				query,
				visitedAt: new Date().toISOString(),
			};
			storedHistory = [...storedHistory, entry];
			return entry;
		}),
	clear: () =>
		Effect.sync(() => {
			storedHistory = [];
		}),
});

export const resetMockSessions = () => {
	sessions = [];
	nextId = 0;
	storedBookmarks = [];
	bookmarkNextId = 0;
	storedHistory = [];
	historyNextId = 0;
};

export const PipelineTestLayer = BrowsingHandlersLive.pipe(
	Layer.provide(SessionFeatureLive),
	Layer.provide(BookmarkFeatureLive),
	Layer.provide(HistoryFeatureLive),
	Layer.provide(OmniboxFeatureLive),
	Layer.provide(MockSessionRepositoryLive),
	Layer.provide(MockBookmarkRepositoryLive),
	Layer.provide(MockHistoryRepositoryLive),
	Layer.provideMerge(TestSpanExporterLive),
) as Layer.Layer<BrowsingRpcs | TestSpanExporter>;
