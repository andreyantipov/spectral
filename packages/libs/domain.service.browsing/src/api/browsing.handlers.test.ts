import type { Bookmark, HistoryEntry, Page, Session } from "@ctrl/core.base.model";
import { DEFAULT_TAB_URL } from "@ctrl/core.base.types";
import { EventBus, EventBusLive } from "@ctrl/core.port.event-bus";
import { BookmarkRepository, HistoryRepository, SessionRepository } from "@ctrl/core.port.storage";
import { BookmarkFeatureLive } from "@ctrl/domain.feature.bookmark";
import { HistoryFeatureLive } from "@ctrl/domain.feature.history";
import { OmniboxFeature } from "@ctrl/domain.feature.omnibox";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import { Chunk, Duration, Effect, Fiber, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { BrowsingServiceLive } from "./browsing.handlers";

// -- Test helpers -------------------------------------------------------------

let nextId = 0;
const makePage = (url: string): Page => ({ url, title: null, loadedAt: new Date().toISOString() });
const makeSession = (mode: "visual"): Session => {
	const id = String(++nextId);
	return {
		id,
		pages: [makePage(DEFAULT_TAB_URL)],
		currentIndex: 0,
		mode,
		isActive: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
};

const makeMockLayers = () => {
	let sessions: Session[] = [];
	let bookmarks: Bookmark[] = [];
	let history: HistoryEntry[] = [];
	nextId = 0;

	const MockSessionRepo = Layer.succeed(SessionRepository, {
		getAll: () => Effect.succeed(sessions),
		getById: (id: string) => Effect.succeed(sessions.find((s) => s.id === id)),
		create: (mode: "visual") =>
			Effect.sync(() => {
				const s = makeSession(mode);
				sessions = [...sessions, s];
				return s;
			}),
		remove: (id: string) =>
			Effect.sync(() => {
				sessions = sessions.filter((s) => s.id !== id);
			}),
		setActive: (id: string) =>
			Effect.sync(() => {
				sessions = sessions.map((s) => ({ ...s, isActive: s.id === id }));
			}),
		updateCurrentIndex: (id: string, index: number) =>
			Effect.sync(() => {
				sessions = sessions.map((s) => (s.id === id ? { ...s, currentIndex: index } : s));
			}),
		addPage: (sessionId: string, url: string, atIndex: number) =>
			Effect.sync(() => {
				const page = makePage(url);
				sessions = sessions.map((s) =>
					s.id === sessionId
						? { ...s, pages: [...s.pages.slice(0, atIndex), page, ...s.pages.slice(atIndex)] }
						: s,
				);
				return page;
			}),
		removePagesAfterIndex: (sessionId: string, index: number) =>
			Effect.sync(() => {
				sessions = sessions.map((s) =>
					s.id === sessionId ? { ...s, pages: s.pages.slice(0, index + 1) } : s,
				);
			}),
		updatePageTitle: (sessionId: string, pageIndex: number, title: string) =>
			Effect.sync(() => {
				sessions = sessions.map((s) =>
					s.id === sessionId
						? { ...s, pages: s.pages.map((p, i) => (i === pageIndex ? { ...p, title } : p)) }
						: s,
				);
			}),
		updatePageUrl: (sessionId: string, pageIndex: number, url: string) =>
			Effect.sync(() => {
				sessions = sessions.map((s) =>
					s.id === sessionId
						? { ...s, pages: s.pages.map((p, i) => (i === pageIndex ? { ...p, url } : p)) }
						: s,
				);
			}),
	});

	const MockBookmarkRepo = Layer.succeed(BookmarkRepository, {
		getAll: () => Effect.succeed(bookmarks),
		create: (url: string, title: string | null) =>
			Effect.sync(() => {
				const bm: Bookmark = {
					id: String(++nextId),
					url,
					title,
					createdAt: new Date().toISOString(),
				};
				bookmarks = [...bookmarks, bm];
				return bm;
			}),
		remove: (id: string) =>
			Effect.sync(() => {
				bookmarks = bookmarks.filter((b) => b.id !== id);
			}),
		findByUrl: (url: string) => Effect.succeed(bookmarks.find((b) => b.url === url)),
	});

	const MockHistoryRepo = Layer.succeed(HistoryRepository, {
		getAll: () => Effect.succeed(history),
		record: (url: string, title: string | null, query?: string | null) =>
			Effect.sync(() => {
				const e: HistoryEntry = {
					id: String(++nextId),
					url,
					title,
					query: query ?? null,
					visitedAt: new Date().toISOString(),
				};
				history = [...history, e];
				return e;
			}),
		clear: () =>
			Effect.sync(() => {
				history = [];
			}),
	});

	const MockOmnibox = Layer.succeed(OmniboxFeature, {
		resolve: (input: string) => Effect.succeed({ url: input, query: null }),
	} as OmniboxFeature["Type"]);

	const SessionLayer = SessionFeatureLive.pipe(Layer.provide(MockSessionRepo));
	const BookmarkLayer = BookmarkFeatureLive.pipe(Layer.provide(MockBookmarkRepo));
	const HistoryLayer = HistoryFeatureLive.pipe(Layer.provide(MockHistoryRepo));

	const ServiceLayer = BrowsingServiceLive.pipe(
		Layer.provide(SessionLayer),
		Layer.provide(BookmarkLayer),
		Layer.provide(HistoryLayer),
		Layer.provide(MockOmnibox),
		Layer.provide(EventBusLive),
	);

	return Layer.mergeAll(
		SessionLayer,
		BookmarkLayer,
		HistoryLayer,
		MockOmnibox,
		EventBusLive,
		ServiceLayer,
	);
};

const runWithService = <A, E>(effect: Effect.Effect<A, E, EventBus>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeMockLayers())));

const sendAndWaitSnapshot = (bus: EventBus["Type"], action: string, payload?: unknown) =>
	Effect.gen(function* () {
		const fiber = yield* bus
			.on("state.snapshot")
			.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
		yield* Effect.sleep(Duration.millis(10)); // let listener start
		yield* bus.send({ type: "command", action, payload, meta: { source: "ui" } });
		yield* Effect.sleep(Duration.millis(200)); // let handler + snapshot run
		const events = Chunk.toArray(yield* Fiber.join(fiber));
		return events[0]?.payload as
			| { sessions: Session[]; bookmarks: Bookmark[]; history: HistoryEntry[] }
			| undefined;
	});

// -- Tests --------------------------------------------------------------------

describe("BrowsingServiceLive — EventBus integration", () => {
	it("service starts and responds to commands", async () => {
		// Initial snapshot fires during Layer init (before test code runs).
		// Verify service is alive by sending diag.ping and getting diag.pong.
		await runWithService(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* Effect.sleep(Duration.millis(50));
				const fiber = yield* bus
					.on("diag.pong")
					.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
				yield* Effect.sleep(Duration.millis(10));
				yield* bus.send({ type: "command", action: "diag.ping" });
				yield* Effect.sleep(Duration.millis(100));
				const events = Chunk.toArray(yield* Fiber.join(fiber));
				expect(events).toHaveLength(1);
			}),
		);
	});

	it("session.create → snapshot with new session", async () => {
		await runWithService(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* Effect.sleep(Duration.millis(50)); // let service start
				const state = yield* sendAndWaitSnapshot(bus, "session.create", { mode: "visual" });
				expect(state).toBeDefined();
				expect(state?.sessions.length).toBeGreaterThanOrEqual(1);
				expect(state?.sessions.some((s) => s.isActive)).toBe(true);
			}),
		);
	}, 10000);

	it("session.close → snapshot without closed session", async () => {
		await runWithService(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* Effect.sleep(Duration.millis(50));
				// Create
				yield* sendAndWaitSnapshot(bus, "session.create", { mode: "visual" });
				// Close
				const state = yield* sendAndWaitSnapshot(bus, "session.close", { id: "1" });
				expect(state).toBeDefined();
				expect(state?.sessions.find((s) => s.id === "1")).toBeUndefined();
			}),
		);
	}, 10000);

	it("nav.navigate → snapshot with updated URL", async () => {
		await runWithService(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* Effect.sleep(Duration.millis(50));
				yield* sendAndWaitSnapshot(bus, "session.create", { mode: "visual" });
				const state = yield* sendAndWaitSnapshot(bus, "nav.navigate", {
					id: "1",
					input: "https://example.com",
				});
				expect(state).toBeDefined();
				const session = state?.sessions.find((s) => s.id === "1");
				expect(session).toBeDefined();
				const url = session?.pages[session?.currentIndex ?? 0]?.url;
				expect(url).toBe("https://example.com");
			}),
		);
	}, 10000);

	it("bm.add → snapshot with new bookmark", async () => {
		await runWithService(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* Effect.sleep(Duration.millis(50));
				const state = yield* sendAndWaitSnapshot(bus, "bm.add", {
					url: "https://example.com",
					title: "Example",
				});
				expect(state).toBeDefined();
				expect(state?.bookmarks).toHaveLength(1);
				expect(state?.bookmarks[0].url).toBe("https://example.com");
			}),
		);
	}, 10000);

	it("diag.ping → publishes diag.pong", async () => {
		await runWithService(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* Effect.sleep(Duration.millis(50));
				const fiber = yield* bus
					.on("diag.pong")
					.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
				yield* Effect.sleep(Duration.millis(10));
				yield* bus.send({ type: "command", action: "diag.ping" });
				yield* Effect.sleep(Duration.millis(100));
				const events = Chunk.toArray(yield* Fiber.join(fiber));
				expect(events).toHaveLength(1);
				expect((events[0].payload as { message: string }).message).toBe("EventBus alive");
			}),
		);
	}, 10000);
});
