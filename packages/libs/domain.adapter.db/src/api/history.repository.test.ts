import { HistoryRepository } from "@ctrl/core.shared";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { LibsqlClient } from "@effect/sql-libsql";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { ensureSchema } from "./ensure-schema";
import { HistoryRepositoryLive } from "./history.repository";

const makeTestLayer = () => {
	const DbLive = LibsqlClient.layer({ url: "file::memory:" });
	const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbLive));
	const SetupLive = Layer.effectDiscard(ensureSchema).pipe(Layer.provide(DbLive));
	return HistoryRepositoryLive.pipe(
		Layer.provide(DrizzleLive),
		Layer.provide(DbLive),
		Layer.provide(SetupLive),
	);
};

const run = <A, E>(effect: Effect.Effect<A, E, HistoryRepository>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("HistoryRepositoryLive", () => {
	it("getAll returns empty array initially", async () => {
		const result = await run(
			Effect.gen(function* () {
				const repo = yield* HistoryRepository;
				return yield* repo.getAll();
			}),
		);
		expect(result).toEqual([]);
	});

	it("record adds an entry and getAll returns it", async () => {
		await run(
			Effect.gen(function* () {
				const repo = yield* HistoryRepository;
				const entry = yield* repo.record("https://example.com", "Example", "example query");
				expect(entry.url).toBe("https://example.com");
				expect(entry.title).toBe("Example");
				expect(entry.query).toBe("example query");
				expect(entry.id).toBeDefined();
				expect(entry.visitedAt).toBeDefined();
				const all = yield* repo.getAll();
				expect(all).toHaveLength(1);
				expect(all[0].query).toBe("example query");
			}),
		);
	});

	it("record with no query stores null", async () => {
		await run(
			Effect.gen(function* () {
				const repo = yield* HistoryRepository;
				const entry = yield* repo.record("https://example.com", null);
				expect(entry.query).toBeNull();
			}),
		);
	});

	it("clear removes all entries", async () => {
		await run(
			Effect.gen(function* () {
				const repo = yield* HistoryRepository;
				yield* repo.record("https://example.com", "Example");
				yield* repo.record("https://other.com", null);
				yield* repo.clear();
				const all = yield* repo.getAll();
				expect(all).toHaveLength(0);
			}),
		);
	});

	it("getAll returns entries in reverse chronological order", async () => {
		await run(
			Effect.gen(function* () {
				const repo = yield* HistoryRepository;
				yield* repo.record("https://first.com", "First");
				yield* repo.record("https://second.com", "Second");
				yield* repo.record("https://third.com", "Third");
				const all = yield* repo.getAll();
				expect(all).toHaveLength(3);
				// Most recent entry should be first
				expect(all[0].url).toBe("https://third.com");
				expect(all[2].url).toBe("https://first.com");
			}),
		);
	});
});
