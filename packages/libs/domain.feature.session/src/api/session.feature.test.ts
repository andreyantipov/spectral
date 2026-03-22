import { DEFAULT_TAB_URL } from "@ctrl/core.base.types";
import { type Page, type Session, SessionRepository } from "@ctrl/core.shared";
import { Chunk, type Context, Duration, Effect, Fiber, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { SessionFeature, SessionFeatureLive } from "./session.feature";

let nextId = 0;

const makePage = (url: string): Page => ({
	url,
	title: null,
	loadedAt: new Date().toISOString(),
});

const makeSession = (mode: "visual"): Session => {
	const id = String(++nextId);
	const page = makePage(DEFAULT_TAB_URL);
	return {
		id,
		pages: [page],
		currentIndex: 0,
		mode,
		isActive: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
};

const makeTestLayer = () => {
	let sessions: Session[] = [];
	nextId = 0;

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
		setActive: (id: string) =>
			Effect.sync(() => {
				sessions = sessions.map((s) => ({
					...s,
					isActive: s.id === id,
				}));
			}),
		updateCurrentIndex: (id: string, index: number) =>
			Effect.sync(() => {
				sessions = sessions.map((s) => (s.id === id ? { ...s, currentIndex: index } : s));
			}),
		addPage: (sessionId: string, url: string, atIndex: number) =>
			Effect.sync(() => {
				const page = makePage(url);
				sessions = sessions.map((s) => {
					if (s.id !== sessionId) return s;
					const pages = [...s.pages];
					pages.splice(atIndex, 0, page);
					return { ...s, pages };
				});
				return page;
			}),
		removePagesAfterIndex: (sessionId: string, index: number) =>
			Effect.sync(() => {
				sessions = sessions.map((s) => {
					if (s.id !== sessionId) return s;
					return { ...s, pages: s.pages.slice(0, index + 1) };
				});
			}),
		updatePageTitle: (sessionId: string, pageIndex: number, title: string) =>
			Effect.sync(() => {
				sessions = sessions.map((s) => {
					if (s.id !== sessionId) return s;
					const pages = s.pages.map((p, i) => (i === pageIndex ? { ...p, title } : p));
					return { ...s, pages };
				});
			}),
		updatePageUrl: (sessionId: string, pageIndex: number, url: string) =>
			Effect.sync(() => {
				sessions = sessions.map((s) => {
					if (s.id !== sessionId) return s;
					const pages = s.pages.map((p, i) => (i === pageIndex ? { ...p, url } : p));
					return { ...s, pages };
				});
			}),
	} satisfies Context.Tag.Service<typeof SessionRepository>);

	return SessionFeatureLive.pipe(Layer.provide(MockSessionRepository));
};

const runTest = <A, E>(effect: Effect.Effect<A, E, SessionFeature>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("SessionFeature", () => {
	it("create() creates session and publishes to changes stream", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;

				const fiber = yield* feature.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));
				const created = yield* feature.create("visual");

				const collected = yield* Fiber.join(fiber);
				const snapshots = Chunk.toArray(collected);

				expect(created.pages).toHaveLength(1);
				expect(created.pages[0].url).toBe(DEFAULT_TAB_URL);
				expect(created.currentIndex).toBe(0);
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]).toHaveLength(1);

				return created;
			}),
		);
		expect(result.mode).toBe("visual");
	});

	it("navigate(id, url) appends page and truncates forward history", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const session = yield* feature.create("visual");

				const updated = yield* feature.navigate(session.id, "https://example.com");

				expect(updated.pages).toHaveLength(2);
				expect(updated.pages[1].url).toBe("https://example.com");
				expect(updated.currentIndex).toBe(1);
			}),
		);
	});

	it("goBack(id) decrements index", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const session = yield* feature.create("visual");
				yield* feature.navigate(session.id, "https://example.com");

				const updated = yield* feature.goBack(session.id);

				expect(updated.currentIndex).toBe(0);
				expect(updated.pages).toHaveLength(2);
			}),
		);
	});

	it("goBack(id) fails when at index 0", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const session = yield* feature.create("visual");

				const exit = yield* feature.goBack(session.id).pipe(Effect.either);
				return exit;
			}).pipe(Effect.provide(makeTestLayer())),
		);

		expect(result._tag).toBe("Left");
	});

	it("goForward(id) increments index", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const session = yield* feature.create("visual");
				yield* feature.navigate(session.id, "https://example.com");
				yield* feature.goBack(session.id);

				const updated = yield* feature.goForward(session.id);

				expect(updated.currentIndex).toBe(1);
				expect(updated.pages[1].url).toBe("https://example.com");
			}),
		);
	});

	it("goForward(id) fails when at end", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const session = yield* feature.create("visual");

				const exit = yield* feature.goForward(session.id).pipe(Effect.either);
				return exit;
			}).pipe(Effect.provide(makeTestLayer())),
		);

		expect(result._tag).toBe("Left");
	});

	it("navigate → back → navigate truncates forward history", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const session = yield* feature.create("visual");

				yield* feature.navigate(session.id, "https://a.com");
				yield* feature.navigate(session.id, "https://b.com");
				yield* feature.goBack(session.id);

				const updated = yield* feature.navigate(session.id, "https://c.com");

				expect(updated.pages).toHaveLength(3);
				expect(updated.pages[0].url).toBe(DEFAULT_TAB_URL);
				expect(updated.pages[1].url).toBe("https://a.com");
				expect(updated.pages[2].url).toBe("https://c.com");
				expect(updated.currentIndex).toBe(2);
			}),
		);
	});

	it("updateTitle(id, title) updates current page title", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const session = yield* feature.create("visual");

				const updated = yield* feature.updateTitle(session.id, "My Title");

				expect(updated.pages[0].title).toBe("My Title");
			}),
		);
	});

	it("remove(id) removes session and publishes", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const session = yield* feature.create("visual");

				const fiber = yield* feature.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));
				yield* feature.remove(session.id);

				const collected = yield* Fiber.join(fiber);
				const snapshots = Chunk.toArray(collected);

				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]).toHaveLength(0);
			}),
		);
	});

	it("getAll returns all sessions", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				yield* feature.create("visual");
				yield* feature.create("visual");

				const all = yield* feature.getAll();
				expect(all).toHaveLength(2);
			}),
		);
	});

	it("setActive marks session as active", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const s1 = yield* feature.create("visual");
				yield* feature.create("visual");

				yield* feature.setActive(s1.id);
				const all = yield* feature.getAll();
				const active = all.find((s) => s.isActive);
				expect(active?.id).toBe(s1.id);
			}),
		);
	});

	it("navigate in one session does not affect another session", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const s1 = yield* feature.create("visual");
				const s2 = yield* feature.create("visual");

				yield* feature.navigate(s1.id, "https://youtube.com/watch?v=AAA");
				yield* feature.navigate(s2.id, "https://youtube.com/watch?v=BBB");

				const all = yield* feature.getAll();
				const session1 = all.find((s) => s.id === s1.id);
				const session2 = all.find((s) => s.id === s2.id);

				expect(session1?.pages[1].url).toBe("https://youtube.com/watch?v=AAA");
				expect(session2?.pages[1].url).toBe("https://youtube.com/watch?v=BBB");
				expect(session1?.currentIndex).toBe(1);
				expect(session2?.currentIndex).toBe(1);
			}),
		);
	});

	it("updateUrl on one session does not affect another", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* SessionFeature;
				const s1 = yield* feature.create("visual");
				const s2 = yield* feature.create("visual");

				yield* feature.navigate(s1.id, "https://youtube.com/watch?v=AAA");
				yield* feature.navigate(s2.id, "https://youtube.com/watch?v=BBB");

				// Simulate redirect: webview reports a different URL for session 1
				yield* feature.updateUrl(s1.id, "https://youtube.com/watch?v=AAA&redirected=1");

				const all = yield* feature.getAll();
				const session1 = all.find((s) => s.id === s1.id);
				const session2 = all.find((s) => s.id === s2.id);

				// Session 1 should have the redirected URL
				expect(session1?.pages[1].url).toBe("https://youtube.com/watch?v=AAA&redirected=1");
				// Session 2 should be unaffected
				expect(session2?.pages[1].url).toBe("https://youtube.com/watch?v=BBB");
			}),
		);
	});
});
