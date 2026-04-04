import { StateSync } from "@ctrl/core.contract.state-sync";
import { Effect, Ref } from "effect";
import { describe, expect, it } from "vitest";
import { StateSyncLive } from "./state-sync.live";

const runTest = <A>(effect: Effect.Effect<A, never, StateSync>) =>
	Effect.runPromise(effect.pipe(Effect.provide(StateSyncLive)));

describe("StateSyncLive", () => {
	it("registers a path and returns snapshot", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const sync = yield* StateSync;
				yield* sync.register("browsing", () => Effect.succeed({ sessions: ["a", "b"] }));
				return yield* sync.getSnapshot();
			}),
		);

		expect(result).toEqual({ browsing: { sessions: ["a", "b"] } });
	});

	it("supports multiple registered paths", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const sync = yield* StateSync;
				yield* sync.register("browsing", () => Effect.succeed({ sessions: [] }));
				yield* sync.register("workspace", () => Effect.succeed({ panels: [1, 2] }));
				return yield* sync.getSnapshot();
			}),
		);

		expect(result).toEqual({
			browsing: { sessions: [] },
			workspace: { panels: [1, 2] },
		});
	});

	it("snapshot reflects latest state from provider", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const sync = yield* StateSync;
				const counter = yield* Ref.make(0);

				yield* sync.register("counter", () =>
					Ref.getAndUpdate(counter, (n) => n + 1).pipe(Effect.map((n) => ({ value: n }))),
				);

				const first = yield* sync.getSnapshot();
				const second = yield* sync.getSnapshot();
				return { first, second };
			}),
		);

		expect(result.first).toEqual({ counter: { value: 0 } });
		expect(result.second).toEqual({ counter: { value: 1 } });
	});
});
