import { ensureSchema } from "@ctrl/arch.impl.db";
import { DEFAULT_TAB_URL } from "@ctrl/base.type";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { LibsqlClient } from "@effect/sql-libsql";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { SessionRepositoryLive } from "./session.repository";
import { SessionRepository } from "./session.repository.tag";

/**
 * Helper: create an in-memory libsql-backed test layer that includes
 * SqliteDrizzle so SessionRepositoryLive can resolve its dependencies.
 */
const makeTestLayer = () => {
	const DbLive = LibsqlClient.layer({ url: "file::memory:" });
	const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbLive));

	// Create the sessions + pages tables before running tests
	const SetupLive = Layer.effectDiscard(ensureSchema).pipe(Layer.provide(DbLive));

	return SessionRepositoryLive.pipe(
		Layer.provide(DrizzleLive),
		Layer.provide(DbLive),
		Layer.provide(SetupLive),
	);
};

const runTest = <A, E>(effect: Effect.Effect<A, E, SessionRepository>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("SessionRepository", () => {
	it("getAll returns empty initially", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* SessionRepository;
				return yield* repo.getAll();
			}),
		);
		expect(result).toEqual([]);
	});

	it("create session → getAll returns it with initial page", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* SessionRepository;
				const session = yield* repo.create("visual");
				expect(session.id).toBeDefined();
				expect(session.mode).toBe("visual");
				expect(session.isActive).toBe(false);
				expect(session.currentIndex).toBe(0);
				expect(session.pages).toHaveLength(1);
				expect(session.pages[0].url).toBe(DEFAULT_TAB_URL);

				const all = yield* repo.getAll();
				expect(all).toHaveLength(1);
				expect(all[0].pages).toHaveLength(1);
				expect(all[0].pages[0].url).toBe(DEFAULT_TAB_URL);
				return all[0];
			}),
		);
		expect(result.mode).toBe("visual");
	});

	it("addPage → getAll returns session with initial + added page", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* SessionRepository;
				const session = yield* repo.create("visual");
				const page = yield* repo.addPage(session.id, "https://example.com", 1);
				expect(page.url).toBe("https://example.com");
				expect(page.title).toBeNull();
				expect(page.loadedAt).toBeDefined();

				const all = yield* repo.getAll();
				expect(all[0].pages).toHaveLength(2);
				expect(all[0].pages[0].url).toBe(DEFAULT_TAB_URL);
				expect(all[0].pages[1].url).toBe("https://example.com");
				return all[0];
			}),
		);
		expect(result.pages).toHaveLength(2);
	});

	it("addPage multiple → pages ordered by pageIndex", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* SessionRepository;
				const session = yield* repo.create("visual");
				yield* repo.addPage(session.id, "https://first.com", 1);
				yield* repo.addPage(session.id, "https://second.com", 2);
				yield* repo.addPage(session.id, "https://third.com", 3);

				const all = yield* repo.getAll();
				const pages = all[0].pages;
				expect(pages).toHaveLength(4);
				expect(pages[0].url).toBe(DEFAULT_TAB_URL);
				expect(pages[1].url).toBe("https://first.com");
				expect(pages[2].url).toBe("https://second.com");
				expect(pages[3].url).toBe("https://third.com");
				return pages;
			}),
		);
		expect(result).toHaveLength(4);
	});

	it("removePagesAfterIndex → truncates forward history", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* SessionRepository;
				const session = yield* repo.create("visual");
				yield* repo.addPage(session.id, "https://first.com", 1);
				yield* repo.addPage(session.id, "https://second.com", 2);
				yield* repo.addPage(session.id, "https://third.com", 3);

				yield* repo.removePagesAfterIndex(session.id, 1);

				const all = yield* repo.getAll();
				const pages = all[0].pages;
				expect(pages).toHaveLength(2);
				expect(pages[0].url).toBe(DEFAULT_TAB_URL);
				expect(pages[1].url).toBe("https://first.com");
				return pages;
			}),
		);
		expect(result).toHaveLength(2);
	});

	it("updateCurrentIndex → changes index", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* SessionRepository;
				const session = yield* repo.create("visual");
				expect(session.currentIndex).toBe(0);

				yield* repo.updateCurrentIndex(session.id, 5);

				const all = yield* repo.getAll();
				expect(all[0].currentIndex).toBe(5);
				return all[0];
			}),
		);
		expect(result.currentIndex).toBe(5);
	});

	it("updatePageTitle → changes page title", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* SessionRepository;
				const session = yield* repo.create("visual");
				yield* repo.addPage(session.id, "https://example.com", 1);

				yield* repo.updatePageTitle(session.id, 1, "Example Page");

				const all = yield* repo.getAll();
				expect(all[0].pages[1].title).toBe("Example Page");
				return all[0];
			}),
		);
		expect(result.pages[1].title).toBe("Example Page");
	});

	it("remove session → cascade deletes pages", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* SessionRepository;
				const session = yield* repo.create("visual");
				yield* repo.addPage(session.id, "https://example.com", 1);
				yield* repo.addPage(session.id, "https://other.com", 2);

				yield* repo.remove(session.id);

				const all = yield* repo.getAll();
				expect(all).toEqual([]);
				return all;
			}),
		);
		expect(result).toEqual([]);
	});

	it("setActive → deactivates all, activates one", async () => {
		await runTest(
			Effect.gen(function* () {
				const repo = yield* SessionRepository;
				const s1 = yield* repo.create("visual");
				const s2 = yield* repo.create("visual");

				yield* repo.setActive(s1.id);
				const all1 = yield* repo.getAll();
				const a1 = all1.find((s) => s.id === s1.id);
				const a2 = all1.find((s) => s.id === s2.id);
				expect(a1?.isActive).toBe(true);
				expect(a2?.isActive).toBe(false);

				// Switch active session
				yield* repo.setActive(s2.id);
				const all2 = yield* repo.getAll();
				const b1 = all2.find((s) => s.id === s1.id);
				const b2 = all2.find((s) => s.id === s2.id);
				expect(b1?.isActive).toBe(false);
				expect(b2?.isActive).toBe(true);
			}),
		);
	});

	it("getById → returns specific session with pages", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* SessionRepository;
				const s1 = yield* repo.create("visual");
				yield* repo.create("visual");
				yield* repo.addPage(s1.id, "https://example.com", 1);

				const found = yield* repo.getById(s1.id);
				expect(found).toBeDefined();
				expect(found?.id).toBe(s1.id);
				expect(found?.pages).toHaveLength(2);
				expect(found?.pages[0].url).toBe(DEFAULT_TAB_URL);
				expect(found?.pages[1].url).toBe("https://example.com");

				const notFound = yield* repo.getById("nonexistent");
				expect(notFound).toBeUndefined();

				return found;
			}),
		);
		expect(result?.pages).toHaveLength(2);
	});
});
