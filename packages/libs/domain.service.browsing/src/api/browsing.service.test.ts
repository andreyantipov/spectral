import type { DatabaseError } from "@ctrl/core.shared";
import {
	type Bookmark,
	BookmarkRepository,
	DEFAULT_TAB_URL,
	type HistoryEntry,
	HistoryRepository,
	type Page,
	type Session,
	SessionRepository,
	spanName,
} from "@ctrl/core.shared";
import {
	assertContainsSpan,
	TestSpanExporter,
	TestSpanExporterLive,
} from "@ctrl/domain.adapter.otel";
import { BOOKMARK_FEATURE, BookmarkFeatureLive } from "@ctrl/domain.feature.bookmark";
import { HISTORY_FEATURE, HistoryFeatureLive } from "@ctrl/domain.feature.history";
import { OmniboxFeatureLive } from "@ctrl/domain.feature.omnibox";
import { SESSION_FEATURE, SessionFeatureLive } from "@ctrl/domain.feature.session";
import { Headers } from "@effect/platform";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { Chunk, Duration, Effect, Fiber, Layer, ManagedRuntime, Stream } from "effect";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BROWSING_SERVICE } from "../lib/constants";
import type { BrowsingState } from "../model/browsing.events";
import { BrowsingHandlersLive } from "./browsing.handlers";
import { BrowsingRpcs } from "./browsing.rpc";

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

const MockSessionRepository = Layer.succeed(SessionRepository, {
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

const MockBookmarkRepository = Layer.succeed(BookmarkRepository, {
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

const MockHistoryRepository = Layer.succeed(HistoryRepository, {
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

const TestLayer = BrowsingHandlersLive.pipe(
	Layer.provide(SessionFeatureLive),
	Layer.provide(BookmarkFeatureLive),
	Layer.provide(HistoryFeatureLive),
	Layer.provide(OmniboxFeatureLive),
	Layer.provide(MockSessionRepository),
	Layer.provide(MockBookmarkRepository),
	Layer.provide(MockHistoryRepository),
	Layer.provideMerge(TestSpanExporterLive),
);

const runtime = ManagedRuntime.make(TestLayer);

afterAll(() => runtime.dispose());

type HandlerFn<P, R> = (payload: P, headers: typeof Headers.empty) => R;

describe("BrowsingService traces", () => {
	beforeEach(() => {
		sessions = [];
		nextId = 0;
		storedBookmarks = [];
		bookmarkNextId = 0;
		storedHistory = [];
		historyNextId = 0;
	});

	it("createSession traces full flow through session feature", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const exporter = yield* TestSpanExporter;
				exporter.reset();

				const createSession = yield* BrowsingRpcs.accessHandler("createSession");
				yield* (
					createSession as HandlerFn<{ mode: "visual" }, Effect.Effect<Session, DatabaseError>>
				)({ mode: "visual" }, Headers.empty);

				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				const expectedBrowsingSpan = spanName(BROWSING_SERVICE, "createSession");
				const expectedSessionSpan = spanName(SESSION_FEATURE, "create");

				assertContainsSpan(spans, expectedBrowsingSpan);
				assertContainsSpan(spans, expectedSessionSpan);

				const browsingSpan = spans.find((s: ReadableSpan) => s.name === expectedBrowsingSpan);
				const sessionSpan = spans.find((s: ReadableSpan) => s.name === expectedSessionSpan);

				expect(browsingSpan).toBeDefined();
				expect(sessionSpan).toBeDefined();
				expect(sessionSpan?.parentSpanContext?.spanId).toBe(browsingSpan?.spanContext().spanId);

				for (const span of spans) {
					expect(span.status.code).not.toBe(2);
				}
			}),
		);
	});

	it("getSessions traces through session feature", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const exporter = yield* TestSpanExporter;
				exporter.reset();

				const getSessions = yield* BrowsingRpcs.accessHandler("getSessions");
				yield* (
					getSessions as HandlerFn<undefined, Effect.Effect<readonly Session[], DatabaseError>>
				)(undefined, Headers.empty);
				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				assertContainsSpan(spans, spanName(BROWSING_SERVICE, "getSessions"));
				assertContainsSpan(spans, spanName(SESSION_FEATURE, "getAll"));
			}),
		);
	});

	it("removeSession traces through session feature", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const exporter = yield* TestSpanExporter;
				exporter.reset();

				const createSession = yield* BrowsingRpcs.accessHandler("createSession");
				yield* (
					createSession as HandlerFn<{ mode: "visual" }, Effect.Effect<Session, DatabaseError>>
				)({ mode: "visual" }, Headers.empty);
				exporter.reset();

				const removeSession = yield* BrowsingRpcs.accessHandler("removeSession");
				yield* (removeSession as HandlerFn<{ id: string }, Effect.Effect<void, DatabaseError>>)(
					{ id: "1" },
					Headers.empty,
				);
				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				assertContainsSpan(spans, spanName(BROWSING_SERVICE, "removeSession"));
				assertContainsSpan(spans, spanName(SESSION_FEATURE, "remove"));
			}),
		);
	});

	it("addBookmark traces through bookmark feature", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const exporter = yield* TestSpanExporter;
				exporter.reset();

				const addBookmark = yield* BrowsingRpcs.accessHandler("addBookmark");
				yield* (
					addBookmark as HandlerFn<
						{ url: string; title: string | null },
						Effect.Effect<Bookmark, DatabaseError>
					>
				)({ url: "https://example.com", title: "Example" }, Headers.empty);

				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				assertContainsSpan(spans, spanName(BROWSING_SERVICE, "addBookmark"));
				assertContainsSpan(spans, spanName(BOOKMARK_FEATURE, "create"));
			}),
		);
	});

	it("navigate traces through session and history features", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const exporter = yield* TestSpanExporter;

				// Create a session first
				const createSession = yield* BrowsingRpcs.accessHandler("createSession");
				yield* (
					createSession as HandlerFn<{ mode: "visual" }, Effect.Effect<Session, DatabaseError>>
				)({ mode: "visual" }, Headers.empty);

				exporter.reset();

				const navigate = yield* BrowsingRpcs.accessHandler("navigate");
				yield* (
					navigate as HandlerFn<
						{ id: string; input: string },
						Effect.Effect<Session, DatabaseError>
					>
				)({ id: "1", input: "https://example.com" }, Headers.empty);

				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				assertContainsSpan(spans, spanName(BROWSING_SERVICE, "navigate"));
				assertContainsSpan(spans, spanName(SESSION_FEATURE, "navigate"));
				assertContainsSpan(spans, spanName(HISTORY_FEATURE, "record"));
			}),
		);
	});

	it("clearHistory traces through history feature", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const exporter = yield* TestSpanExporter;
				exporter.reset();

				const clearHistory = yield* BrowsingRpcs.accessHandler("clearHistory");
				yield* (clearHistory as HandlerFn<undefined, Effect.Effect<void, DatabaseError>>)(
					undefined,
					Headers.empty,
				);

				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				assertContainsSpan(spans, spanName(BROWSING_SERVICE, "clearHistory"));
				assertContainsSpan(spans, spanName(HISTORY_FEATURE, "clear"));
			}),
		);
	});

	it("browsingChanges stream emits combined BrowsingState", async () => {
		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const browsingChanges = yield* BrowsingRpcs.accessHandler("browsingChanges");
				const stream = (
					browsingChanges as HandlerFn<undefined, Stream.Stream<BrowsingState, never>>
				)(undefined, Headers.empty);

				// zipLatest with prepended initial values should emit immediately
				const fiber = yield* stream.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(50));

				const collected = yield* Fiber.join(fiber);
				return Chunk.toArray(collected);
			}),
		);

		expect(result).toHaveLength(1);
		expect(result[0].sessions).toEqual([]);
		expect(result[0].bookmarks).toEqual([]);
		expect(result[0].history).toEqual([]);
	});
});
