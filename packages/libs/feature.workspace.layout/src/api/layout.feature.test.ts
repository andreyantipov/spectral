import { LayoutRepository } from "@ctrl/base.model.layout";
import type { PersistedLayout } from "@ctrl/base.schema";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { makeGroupNode } from "../lib/tree-ops";
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
				const root = makeGroupNode([], "");
				const persisted: PersistedLayout = { version: 2, root };
				yield* feature.updateLayout(persisted);
				const layout = yield* feature.getPersistedLayout();
				expect(layout?.version).toBe(2);
				expect(layout?.root.type).toBe("group");
			}),
		);
	});
});
