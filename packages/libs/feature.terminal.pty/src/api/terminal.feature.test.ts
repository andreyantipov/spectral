import { TerminalPort } from "@ctrl/arch.contract.terminal";
import { Effect, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { TerminalFeature, TerminalFeatureLive } from "./terminal.feature";

const MockTerminalPort = Layer.succeed(TerminalPort, {
	spawn: (_opts) => Effect.succeed({ id: `mock-${Date.now()}` }),
	write: () => Effect.void,
	resize: () => Effect.void,
	close: () => Effect.void,
	output: () => Stream.empty,
});

const TestLayer = TerminalFeatureLive.pipe(Layer.provide(MockTerminalPort));

const run = <A, E>(effect: Effect.Effect<A, E, TerminalFeature>) =>
	Effect.runPromise(Effect.provide(effect, TestLayer));

describe("TerminalFeature", () => {
	it("creates a terminal and adds to registry", async () => {
		await run(
			Effect.gen(function* () {
				const feature = yield* TerminalFeature;
				const { id } = yield* feature.create({});
				expect(id).toBeTruthy();
				const list = yield* feature.list();
				expect(list.length).toBe(1);
				expect(list[0].id).toBe(id);
			}),
		);
	});

	it("closes a terminal and removes from registry", async () => {
		await run(
			Effect.gen(function* () {
				const feature = yield* TerminalFeature;
				const { id } = yield* feature.create({});
				yield* feature.close(id);
				const list = yield* feature.list();
				expect(list.length).toBe(0);
			}),
		);
	});

	it("tracks resize in registry", async () => {
		await run(
			Effect.gen(function* () {
				const feature = yield* TerminalFeature;
				const { id } = yield* feature.create({});
				yield* feature.resize(id, 120, 40);
				const list = yield* feature.list();
				expect(list[0].cols).toBe(120);
				expect(list[0].rows).toBe(40);
			}),
		);
	});

	it("returns error for unknown terminal", async () => {
		await run(
			Effect.gen(function* () {
				const feature = yield* TerminalFeature;
				const exit = yield* feature.close("nonexistent").pipe(Effect.either);
				expect(exit._tag).toBe("Left");
			}),
		);
	});
});
