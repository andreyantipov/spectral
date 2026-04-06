import { BookmarkRepository } from "./bookmark.repository.tag";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { LibsqlClient } from "@effect/sql-libsql";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { BookmarkRepositoryLive } from "./bookmark.repository";
import { ensureSchema } from "@ctrl/arch.impl.db";

const makeTestLayer = () => {
	const DbLive = LibsqlClient.layer({ url: "file::memory:" });
	const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbLive));
	const SetupLive = Layer.effectDiscard(ensureSchema).pipe(Layer.provide(DbLive));
	return BookmarkRepositoryLive.pipe(
		Layer.provide(DrizzleLive),
		Layer.provide(DbLive),
		Layer.provide(SetupLive),
	);
};

const run = <A, E>(effect: Effect.Effect<A, E, BookmarkRepository>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("BookmarkRepositoryLive", () => {
	it("getAll returns empty array initially", async () => {
		const result = await run(
			Effect.gen(function* () {
				const repo = yield* BookmarkRepository;
				return yield* repo.getAll();
			}),
		);
		expect(result).toEqual([]);
	});

	it("create adds a bookmark and getAll returns it", async () => {
		await run(
			Effect.gen(function* () {
				const repo = yield* BookmarkRepository;
				const created = yield* repo.create("https://example.com", "Example");
				expect(created.url).toBe("https://example.com");
				expect(created.title).toBe("Example");
				expect(created.id).toBeDefined();
				const all = yield* repo.getAll();
				expect(all).toHaveLength(1);
			}),
		);
	});

	it("remove deletes a bookmark", async () => {
		await run(
			Effect.gen(function* () {
				const repo = yield* BookmarkRepository;
				const created = yield* repo.create("https://example.com", null);
				yield* repo.remove(created.id);
				const all = yield* repo.getAll();
				expect(all).toHaveLength(0);
			}),
		);
	});

	it("findByUrl returns matching bookmark", async () => {
		await run(
			Effect.gen(function* () {
				const repo = yield* BookmarkRepository;
				yield* repo.create("https://example.com", "Example");
				const found = yield* repo.findByUrl("https://example.com");
				expect(found).toBeDefined();
				expect(found?.url).toBe("https://example.com");
				const notFound = yield* repo.findByUrl("https://other.com");
				expect(notFound).toBeUndefined();
			}),
		);
	});
});
