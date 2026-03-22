import { LayoutRepository } from "@ctrl/core.port.storage";
import { Chunk, Duration, Effect, Fiber, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import type { PersistedLayout } from "../model/layout.validators";
import { LayoutFeature, LayoutFeatureLive } from "./layout.feature";

const makeTestLayer = () => {
	let stored: PersistedLayout | null = null;

	const MockRepo = Layer.succeed(LayoutRepository, {
		getLayout: () => Effect.succeed(stored),
		saveLayout: (layout: PersistedLayout) =>
			Effect.sync(() => {
				stored = layout;
			}),
	});

	return LayoutFeatureLive.pipe(Layer.provide(MockRepo));
};

const runTest = <A, E>(effect: Effect.Effect<A, E, LayoutFeature>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("LayoutFeature", () => {
	it("returns default single-pane layout when no persisted state", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* LayoutFeature;
				const layout = yield* feature.getLayout();
				expect(layout.type).toBe("group");
			}),
		);
	});

	it("persists layout on update", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* LayoutFeature;
				const dockviewState = { some: "state" };
				yield* feature.updateLayout({ version: 1, dockviewState });
				const layout = yield* feature.getPersistedLayout();
				expect(layout?.version).toBe(1);
			}),
		);
	});

	it("emits changes on stream after update", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* LayoutFeature;
				const fiber = yield* feature.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
				yield* Effect.sleep(Duration.millis(10));
				yield* feature.updateLayout({ version: 1, dockviewState: {} });
				const collected = yield* Fiber.join(fiber);
				expect(Chunk.toArray(collected)).toHaveLength(1);
			}),
		);
	});
});
