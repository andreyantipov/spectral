import { type Tab, TabRepository } from "@ctrl/core.shared";
import { Chunk, Duration, Effect, Fiber, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { TabFeature, TabFeatureLive } from "./tab.service";

let nextId = 0;
const makeTab = (url: string): Tab => {
	const id = String(++nextId);
	return {
		id,
		url,
		title: null,
		position: 0,
		isActive: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
};

const makeTestLayer = () => {
	let tabs: Tab[] = [];
	nextId = 0;

	const MockTabRepository = Layer.succeed(TabRepository, {
		getAll: () => Effect.succeed(tabs),
		create: (url: string) =>
			Effect.sync(() => {
				const tab = makeTab(url);
				tabs = [...tabs, tab];
				return tab;
			}),
		remove: (id: string) =>
			Effect.sync(() => {
				tabs = tabs.filter((t) => t.id !== id);
			}),
		update: (_id: string, _data: Partial<Tab>) => Effect.void,
		getActive: () => Effect.succeed(undefined),
		setActive: (_id: string) => Effect.void,
	});

	return TabFeatureLive.pipe(Layer.provide(MockTabRepository));
};

const runTest = <A, E>(effect: Effect.Effect<A, E, TabFeature>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("TabFeature", () => {
	it("getAll returns data from the repository", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const tab = yield* TabFeature;
				yield* tab.create("https://example.com");
				return yield* tab.getAll();
			}),
		);
		expect(result).toHaveLength(1);
		expect(result[0].url).toBe("https://example.com");
	});

	it("create publishes new state to the changes stream", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const tab = yield* TabFeature;

				const fiber = yield* tab.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));
				yield* tab.create("https://example.com");

				const collected = yield* Fiber.join(fiber);
				return Chunk.toArray(collected);
			}),
		);
		expect(result).toHaveLength(1);
		expect(result[0]).toHaveLength(1);
		expect(result[0][0].url).toBe("https://example.com");
	});

	it("remove publishes updated state to the changes stream", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const tab = yield* TabFeature;

				// Create a tab first (outside stream subscription)
				const created = yield* tab.create("https://example.com");

				// Now subscribe and remove
				const fiber = yield* tab.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));
				yield* tab.remove(created.id);

				const collected = yield* Fiber.join(fiber);
				return Chunk.toArray(collected);
			}),
		);
		expect(result).toHaveLength(1);
		expect(result[0]).toHaveLength(0);
	});
});
