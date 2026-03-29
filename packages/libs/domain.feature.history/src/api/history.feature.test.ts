import type { HistoryEntry } from "@ctrl/base.schema";
import { HistoryRepository } from "@ctrl/core.contract.storage";
import { type Context, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { HistoryFeature, HistoryFeatureLive } from "./history.feature";

let nextId = 0;

const makeEntry = (
	url: string,
	title: string | null,
	query: string | null = null,
): HistoryEntry => ({
	id: String(++nextId),
	url,
	title,
	query,
	visitedAt: new Date().toISOString(),
});

const makeTestLayer = () => {
	let entries: HistoryEntry[] = [];
	nextId = 0;

	const MockHistoryRepository = Layer.succeed(HistoryRepository, {
		getAll: () => Effect.succeed(entries),
		record: (url: string, title: string | null, query: string | null = null) =>
			Effect.sync(() => {
				const entry = makeEntry(url, title, query);
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
	it("record() adds entry", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* HistoryFeature;
				const entry = yield* feature.record("https://example.com", "Example");

				expect(entry.url).toBe("https://example.com");
				expect(entry.title).toBe("Example");

				const all = yield* feature.getAll();
				expect(all).toHaveLength(1);
				expect(all[0].url).toBe("https://example.com");
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

	it("record() with query stores the query", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* HistoryFeature;
				const entry = yield* feature.record(
					"https://www.google.com/search?q=effect",
					null,
					"effect",
				);
				expect(entry.query).toBe("effect");
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

	it("clear() removes all entries", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* HistoryFeature;
				yield* feature.record("https://a.com", "A");
				yield* feature.record("https://b.com", "B");

				yield* feature.clear();

				const all = yield* feature.getAll();
				expect(all).toHaveLength(0);
			}),
		);
	});
});
