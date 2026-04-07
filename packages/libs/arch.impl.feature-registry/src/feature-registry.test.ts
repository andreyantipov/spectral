import { describe, expect, it } from "bun:test";
import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry";
import { Effect } from "effect";
import { FeatureRegistryLive } from "./feature-registry";

const run = <A>(effect: Effect.Effect<A, unknown, FeatureRegistry>) =>
	Effect.runPromise(effect.pipe(Effect.provide(FeatureRegistryLive)));

describe("FeatureRegistry", () => {
	it("registers and executes an effect", async () => {
		const result = await run(
			Effect.gen(function* () {
				const reg = yield* FeatureRegistry;
				yield* reg.register("test.effect", (p) => Effect.succeed(p.value));
				return yield* reg.execute("test.effect", { value: 42 });
			}),
		);
		expect(result).toBe(42);
	});

	it("fails for unknown effect", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const reg = yield* FeatureRegistry;
				return yield* reg.execute("unknown", {});
			}).pipe(Effect.provide(FeatureRegistryLive), Effect.either),
		);
		expect(result._tag).toBe("Left");
	});

	it("registerAll registers multiple effects", async () => {
		const result = await run(
			Effect.gen(function* () {
				const reg = yield* FeatureRegistry;
				yield* reg.registerAll({
					a: () => Effect.succeed("aa"),
					b: () => Effect.succeed("bb"),
				});
				const a = yield* reg.execute("a", {});
				const b = yield* reg.execute("b", {});
				return { a, b };
			}),
		);
		expect(result).toEqual({ a: "aa", b: "bb" });
	});

	it("has() returns correct value", async () => {
		const result = await run(
			Effect.gen(function* () {
				const reg = yield* FeatureRegistry;
				yield* reg.register("exists", () => Effect.void);
				return { yes: yield* reg.has("exists"), no: yield* reg.has("nope") };
			}),
		);
		expect(result).toEqual({ yes: true, no: false });
	});

	it("later registration overrides earlier", async () => {
		const result = await run(
			Effect.gen(function* () {
				const reg = yield* FeatureRegistry;
				yield* reg.register("x", () => Effect.succeed("old"));
				yield* reg.register("x", () => Effect.succeed("new"));
				return yield* reg.execute("x", {});
			}),
		);
		expect(result).toBe("new");
	});
});
