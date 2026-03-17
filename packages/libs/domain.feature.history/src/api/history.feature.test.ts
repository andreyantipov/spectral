import { type HistoryEntry, HistoryRepository } from "@ctrl/core.shared";
import { Chunk, type Context, Duration, Effect, Fiber, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { HistoryFeature, HistoryFeatureLive } from "./history.feature";

let nextId = 0;

const makeEntry = (url: string, title: string | null): HistoryEntry => ({
	id: String(++nextId),
	url,
	title,
	query: null,
	visitedAt: new Date().toISOString(),
});

const makeTestLayer = () => {
	let entries: HistoryEntry[] = [];
	nextId = 0;

	const MockHistoryRepository = Layer.succeed(HistoryRepository, {
		getAll: () => Effect.succeed(entries),
		record: (url: string, title: string | null) =>
			Effect.sync(() => {
				const entry = makeEntry(url, title);
				entries = [...entries, entry];
				return entry;
			}),
		clear: () =>
			Effect.sync(() => {
				entries = [];
			}),
	} satisfies Context.Tag.Service<typeof HistoryRepository>);

	return HistoryFeatureLive.pipe(Layer.provide(MockHistoryRepository));
};

const runTest = <A, E>(effect: Effect.Effect<A, E, HistoryFeature>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("HistoryFeature", () => {
	it("record() adds entry and publishes to changes stream", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* HistoryFeature;

				const fiber = yield* feature.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));
				const entry = yield* feature.record("https://example.com", "Example");

				const collected = yield* Fiber.join(fiber);
				const snapshots = Chunk.toArray(collected);

				expect(entry.url).toBe("https://example.com");
				expect(entry.title).toBe("Example");
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]).toHaveLength(1);
				expect(snapshots[0][0].url).toBe("https://example.com");
			}),
		);
	});

	it("record() with null title stores null", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* HistoryFeature;
				const entry = yield* feature.record("https://example.com", null);
				expect(entry.title).toBeNull();
			}),
		);
	});

	it("getAll() returns all entries", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* HistoryFeature;
				yield* feature.record("https://a.com", "A");
				yield* feature.record("https://b.com", "B");

				const all = yield* feature.getAll();
				expect(all).toHaveLength(2);
				expect(all[0].url).toBe("https://a.com");
				expect(all[1].url).toBe("https://b.com");
			}),
		);
	});

	it("clear() removes all entries and publishes", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* HistoryFeature;
				yield* feature.record("https://a.com", "A");
				yield* feature.record("https://b.com", "B");

				const fiber = yield* feature.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));
				yield* feature.clear();

				const collected = yield* Fiber.join(fiber);
				const snapshots = Chunk.toArray(collected);

				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]).toHaveLength(0);

				const all = yield* feature.getAll();
				expect(all).toHaveLength(0);
			}),
		);
	});
});
