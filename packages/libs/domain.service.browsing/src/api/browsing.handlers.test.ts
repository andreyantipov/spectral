import type { Bookmark, HistoryEntry, Page, Session } from "@ctrl/base.schema";
import { DEFAULT_TAB_URL } from "@ctrl/base.type";
import type { AppCommand, AppEvent } from "@ctrl/core.contract.event-bus";
import {
	BookmarkEvents,
	EventBus,
	NavigationEvents,
	SessionEvents,
} from "@ctrl/core.contract.event-bus";
import { StateSync } from "@ctrl/core.contract.state-sync";
import {
	BookmarkRepository,
	HistoryRepository,
	SessionRepository,
} from "@ctrl/core.contract.storage";
import { BookmarkFeatureLive } from "@ctrl/domain.feature.bookmark";
import { HistoryFeatureLive } from "@ctrl/domain.feature.history";
import { OmniboxFeature } from "@ctrl/domain.feature.omnibox";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import { EventJournal, EventLog as EventLogMod } from "@effect/experimental";
import { Duration, Effect, Layer, PubSub, Ref, Stream } from "effect";
import { describe, expect, it } from "vitest";
import {
	BookmarkHandlers,
	NavigationHandlers,
	SessionHandlers,
	WebBrowsingServiceLive,
} from "./browsing.handlers";

// -- Test helpers -------------------------------------------------------------

const TestEventBusLive = Layer.effect(
	EventBus,
	Effect.gen(function* () {
		const commandPub = yield* PubSub.unbounded<AppCommand>();
		const eventPub = yield* PubSub.unbounded<AppEvent>();
		return {
			send: (cmd: AppCommand) => PubSub.publish(commandPub, cmd).pipe(Effect.asVoid),
			publish: (evt: AppEvent) => PubSub.publish(eventPub, evt).pipe(Effect.asVoid),
			commands: Stream.fromPubSub(commandPub),
			events: Stream.fromPubSub(eventPub),
			on: (name: string) => Stream.fromPubSub(eventPub).pipe(Stream.filter((e) => e.name === name)),
		};
	}),
);

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

	// Mock StateSync that captures registered providers
	const MockStateSyncLive = Layer.effect(
		StateSync,
		Effect.gen(function* () {
			const providers = yield* Ref.make<Record<string, () => Effect.Effect<unknown>>>({});
			return {
				register: (path: string, snapshot: () => Effect.Effect<unknown>) =>
					Ref.update(providers, (p) => ({ ...p, [path]: snapshot })),
				getSnapshot: () =>
					Effect.gen(function* () {
						const p = yield* Ref.get(providers);
						const entries = Object.entries(p);
						const results = yield* Effect.all(
							entries.map(([k, fn]) => fn().pipe(Effect.map((v) => [k, v] as const))),
						);
						return Object.fromEntries(results);
					}),
			};
		}),
	);

	const SessionLayer = SessionFeatureLive.pipe(Layer.provide(MockSessionRepo));
	const BookmarkLayer = BookmarkFeatureLive.pipe(Layer.provide(MockBookmarkRepo));
	const HistoryLayer = HistoryFeatureLive.pipe(Layer.provide(MockHistoryRepo));

	// EventLog layers (required by WebBrowsingServiceLive)
	const IdentityLive = Layer.succeed(EventLogMod.Identity, EventLogMod.Identity.makeRandom());
	const JournalLive = EventJournal.layerMemory;

	const HandlersLive = Layer.mergeAll(
		SessionHandlers.pipe(Layer.provide(SessionLayer)),
		NavigationHandlers.pipe(
			Layer.provide(SessionLayer),
			Layer.provide(MockOmnibox),
			Layer.provide(HistoryLayer),
			Layer.provide(TestEventBusLive),
		),
		BookmarkHandlers.pipe(Layer.provide(BookmarkLayer)),
	);
	const EventLogLive = EventLogMod.layer(
		EventLogMod.schema(SessionEvents, NavigationEvents, BookmarkEvents),
	).pipe(Layer.provide(HandlersLive), Layer.provide(JournalLive), Layer.provide(IdentityLive));

	const ServiceLayer = WebBrowsingServiceLive.pipe(
		Layer.provide(EventLogLive),
		Layer.provide(SessionLayer),
		Layer.provide(BookmarkLayer),
		Layer.provide(HistoryLayer),
		Layer.provide(MockOmnibox),
		Layer.provide(TestEventBusLive),
		Layer.provide(MockStateSyncLive),
	);

	return Layer.mergeAll(
		SessionLayer,
		BookmarkLayer,
		HistoryLayer,
		MockOmnibox,
		TestEventBusLive,
		MockStateSyncLive,
		ServiceLayer,
	);
};

const runWithService = <A, E>(effect: Effect.Effect<A, E, EventBus | StateSync>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeMockLayers())));

const sendAndWait = (bus: EventBus["Type"], action: string, payload?: unknown) =>
	Effect.gen(function* () {
		yield* bus.send({ type: "command", action, payload, meta: { source: "ui" } });
		yield* Effect.sleep(Duration.millis(200)); // let handler run
	});

// -- Tests --------------------------------------------------------------------

describe("WebBrowsingServiceLive — EventBus integration", () => {
	it("service starts and registers with StateSync", async () => {
		await runWithService(
			Effect.gen(function* () {
				const sync = yield* StateSync;
				yield* Effect.sleep(Duration.millis(50));
				const snapshot = yield* sync.getSnapshot();
				expect(snapshot.browsing).toBeDefined();
				const browsing = snapshot.browsing as {
					sessions: Session[];
					bookmarks: Bookmark[];
					history: HistoryEntry[];
				};
				expect(browsing.sessions).toBeDefined();
				expect(browsing.bookmarks).toBeDefined();
				expect(browsing.history).toBeDefined();
			}),
		);
	});

	it("session.create → state reflects new session", async () => {
		await runWithService(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				const sync = yield* StateSync;
				yield* Effect.sleep(Duration.millis(50)); // let service start
				yield* sendAndWait(bus, "session.create", { mode: "visual" });
				const snapshot = yield* sync.getSnapshot();
				const browsing = snapshot.browsing as {
					sessions: Session[];
					bookmarks: Bookmark[];
					history: HistoryEntry[];
				};
				expect(browsing.sessions.length).toBeGreaterThanOrEqual(1);
				expect(browsing.sessions.some((s) => s.isActive)).toBe(true);
			}),
		);
	}, 10000);

	it("session.close → state without closed session", async () => {
		await runWithService(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				const sync = yield* StateSync;
				yield* Effect.sleep(Duration.millis(50));
				// Create
				yield* sendAndWait(bus, "session.create", { mode: "visual" });
				// Close
				yield* sendAndWait(bus, "session.close", { id: "1" });
				const snapshot = yield* sync.getSnapshot();
				const browsing = snapshot.browsing as {
					sessions: Session[];
					bookmarks: Bookmark[];
					history: HistoryEntry[];
				};
				expect(browsing.sessions.find((s) => s.id === "1")).toBeUndefined();
			}),
		);
	}, 10000);

	it("nav.navigate → state with updated URL", async () => {
		await runWithService(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				const sync = yield* StateSync;
				yield* Effect.sleep(Duration.millis(50));
				yield* sendAndWait(bus, "session.create", { mode: "visual" });
				yield* sendAndWait(bus, "nav.navigate", {
					id: "1",
					input: "https://example.com",
				});
				const snapshot = yield* sync.getSnapshot();
				const browsing = snapshot.browsing as {
					sessions: Session[];
					bookmarks: Bookmark[];
					history: HistoryEntry[];
				};
				const session = browsing.sessions.find((s) => s.id === "1");
				expect(session).toBeDefined();
				const url = session?.pages[session?.currentIndex ?? 0]?.url;
				expect(url).toBe("https://example.com");
			}),
		);
	}, 10000);

	it("bm.add → state with new bookmark", async () => {
		await runWithService(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				const sync = yield* StateSync;
				yield* Effect.sleep(Duration.millis(50));
				yield* sendAndWait(bus, "bm.add", {
					url: "https://example.com",
					title: "Example",
				});
				const snapshot = yield* sync.getSnapshot();
				const browsing = snapshot.browsing as {
					sessions: Session[];
					bookmarks: Bookmark[];
					history: HistoryEntry[];
				};
				expect(browsing.bookmarks).toHaveLength(1);
				expect(browsing.bookmarks[0].url).toBe("https://example.com");
			}),
		);
	}, 10000);
});
