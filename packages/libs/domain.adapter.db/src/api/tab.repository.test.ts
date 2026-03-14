import { type Tab, TabRepository } from "@ctrl/core.shared";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { LibsqlClient } from "@effect/sql-libsql";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { TabRepositoryLive } from "./tab.repository";

/**
 * Helper: create an in-memory libsql-backed test layer that includes
 * SqliteDrizzle so TabRepositoryLive can resolve its dependencies.
 */
const makeTestLayer = () => {
	const DbLive = LibsqlClient.layer({ url: "file::memory:" });
	const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbLive));

	// Create the tabs table before running tests
	const SetupLive = Layer.effectDiscard(
		Effect.gen(function* () {
			const sql = yield* LibsqlClient.LibsqlClient;
			yield* sql`
				CREATE TABLE IF NOT EXISTS tabs (
					id TEXT PRIMARY KEY,
					url TEXT NOT NULL,
					title TEXT,
					position INTEGER NOT NULL DEFAULT 0,
					isActive INTEGER NOT NULL DEFAULT 0,
					createdAt TEXT NOT NULL,
					updatedAt TEXT NOT NULL
				)
			`;
		}),
	).pipe(Layer.provide(DbLive));

	return TabRepositoryLive.pipe(
		Layer.provide(DrizzleLive),
		Layer.provide(DbLive),
		Layer.provide(SetupLive),
	);
};

const runTest = <A, E>(effect: Effect.Effect<A, E, TabRepository>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("TabRepository", () => {
	it("getAll returns empty initially", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* TabRepository;
				return yield* repo.getAll();
			}),
		);
		expect(result).toEqual([]);
	});

	it("create adds a tab and returns it", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* TabRepository;
				return yield* repo.create("https://example.com");
			}),
		);
		expect(result).toMatchObject({
			url: "https://example.com",
			isActive: false,
			position: 0,
		});
		expect(result.id).toBeDefined();
		expect(result.createdAt).toBeDefined();
		expect(result.updatedAt).toBeDefined();
	});

	it("getAll after create returns the tab", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* TabRepository;
				yield* repo.create("https://example.com");
				return yield* repo.getAll();
			}),
		);
		expect(result).toHaveLength(1);
		expect(result[0].url).toBe("https://example.com");
	});

	it("remove deletes the tab", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* TabRepository;
				const tab = yield* repo.create("https://example.com");
				yield* repo.remove(tab.id);
				return yield* repo.getAll();
			}),
		);
		expect(result).toEqual([]);
	});

	it("update modifies tab fields", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* TabRepository;
				const tab = yield* repo.create("https://example.com");
				yield* repo.update(tab.id, { title: "Updated Title" });
				return yield* repo.getAll();
			}),
		);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Updated Title");
	});

	it("getActive returns undefined when no tab is active", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* TabRepository;
				yield* repo.create("https://example.com");
				return yield* repo.getActive();
			}),
		);
		expect(result).toBeUndefined();
	});

	it("setActive activates a tab and deactivates others", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* TabRepository;
				const tab1 = yield* repo.create("https://one.com");
				const tab2 = yield* repo.create("https://two.com");
				yield* repo.setActive(tab1.id);

				const active1 = yield* repo.getActive();
				expect(active1?.id).toBe(tab1.id);

				// Switch active tab
				yield* repo.setActive(tab2.id);
				const active2 = yield* repo.getActive();
				expect(active2?.id).toBe(tab2.id);

				// Verify tab1 is no longer active
				const all = yield* repo.getAll();
				const t1 = all.find((t: Tab) => t.id === tab1.id);
				expect(t1?.isActive).toBe(false);

				return active2;
			}),
		);
		expect(result?.url).toBe("https://two.com");
	});
});
