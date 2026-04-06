import { describe, expect, it } from "bun:test";
import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry";
import { FeatureRegistryLive } from "@ctrl/arch.impl.feature-registry";
import { Effect, Layer, Ref } from "effect";
import { SpecRunnerInternal, SpecRunnerLive } from "./runner";

const SimpleSpec = {
	id: "simple",
	version: 1,
	domain: "test",
	mode: "instance" as const,
	initial: "idle",
	triggers: ["Start"],
	terminalOn: ["Stop"],
	states: {
		idle: { on: { DoWork: { target: "working", effects: ["do.work"] } } },
		working: {
			on: {
				DoMore: { target: "working", effects: ["do.more"] },
				Stop: { target: "stopped" },
			},
		},
		stopped: {},
	},
};

const GuardSpec = {
	id: "guarded",
	version: 1,
	domain: "test",
	mode: "instance" as const,
	initial: "idle",
	triggers: ["Start"],
	terminalOn: [],
	states: {
		idle: {
			on: {
				Go: {
					target: "active",
					guards: ["is.allowed"],
					effects: ["do.thing"],
				},
			},
		},
		active: {},
	},
};

const TestLayer = Layer.mergeAll(
	SpecRunnerLive.pipe(Layer.provide(FeatureRegistryLive)),
	FeatureRegistryLive,
);

const runTest = <A>(effect: Effect.Effect<A, unknown, SpecRunnerInternal | FeatureRegistry>) =>
	Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(TestLayer)));

describe("SpecRunner", () => {
	it("processes action through transition and calls effect", async () => {
		await runTest(
			Effect.gen(function* () {
				const runner = yield* SpecRunnerInternal;
				const registry = yield* FeatureRegistry;
				const called = yield* Ref.make(false);

				yield* registry.register("do.work", () => Ref.set(called, true).pipe(Effect.as(undefined)));
				yield* runner.registerSpec(SimpleSpec);
				yield* runner.spawn("simple", "inst-1");
				yield* runner.dispatch("inst-1", { _tag: "DoWork" });
				yield* Effect.sleep("50 millis");

				const wasCalled = yield* Ref.get(called);
				expect(wasCalled).toBe(true);
			}),
		);
	});

	it("drops action when no transition exists", async () => {
		await runTest(
			Effect.gen(function* () {
				const runner = yield* SpecRunnerInternal;
				const registry = yield* FeatureRegistry;
				const called = yield* Ref.make(false);

				yield* registry.register("do.work", () => Ref.set(called, true).pipe(Effect.as(undefined)));
				yield* runner.registerSpec(SimpleSpec);
				yield* runner.spawn("simple", "inst-2");
				// Stop is not valid from idle state
				yield* runner.dispatch("inst-2", { _tag: "Stop" });
				yield* Effect.sleep("50 millis");

				const wasCalled = yield* Ref.get(called);
				expect(wasCalled).toBe(false);
			}),
		);
	});

	it("advances through multiple states", async () => {
		await runTest(
			Effect.gen(function* () {
				const runner = yield* SpecRunnerInternal;
				const registry = yield* FeatureRegistry;
				const log: string[] = [];

				yield* registry.register("do.work", () =>
					Effect.sync(() => {
						log.push("do.work");
					}),
				);
				yield* registry.register("do.more", () =>
					Effect.sync(() => {
						log.push("do.more");
					}),
				);

				yield* runner.registerSpec(SimpleSpec);
				yield* runner.spawn("simple", "inst-3");

				yield* runner.dispatch("inst-3", { _tag: "DoWork" });
				yield* Effect.sleep("50 millis");
				yield* runner.dispatch("inst-3", { _tag: "DoMore" });
				yield* Effect.sleep("50 millis");
				yield* runner.dispatch("inst-3", { _tag: "Stop" });
				yield* Effect.sleep("50 millis");

				expect(log).toEqual(["do.work", "do.more"]);
			}),
		);
	});

	it("guard blocks transition when returns false", async () => {
		await runTest(
			Effect.gen(function* () {
				const runner = yield* SpecRunnerInternal;
				const registry = yield* FeatureRegistry;
				const called = yield* Ref.make(false);

				yield* registry.register("is.allowed", () => Effect.succeed(false));
				yield* registry.register("do.thing", () =>
					Ref.set(called, true).pipe(Effect.as(undefined)),
				);

				yield* runner.registerSpec(GuardSpec);
				yield* runner.spawn("guarded", "inst-4");
				yield* runner.dispatch("inst-4", { _tag: "Go" });
				yield* Effect.sleep("50 millis");

				const wasCalled = yield* Ref.get(called);
				expect(wasCalled).toBe(false);
			}),
		);
	});

	it("guard allows transition when returns true", async () => {
		await runTest(
			Effect.gen(function* () {
				const runner = yield* SpecRunnerInternal;
				const registry = yield* FeatureRegistry;
				const called = yield* Ref.make(false);

				yield* registry.register("is.allowed", () => Effect.succeed(true));
				yield* registry.register("do.thing", () =>
					Ref.set(called, true).pipe(Effect.as(undefined)),
				);

				yield* runner.registerSpec(GuardSpec);
				yield* runner.spawn("guarded", "inst-5");
				yield* runner.dispatch("inst-5", { _tag: "Go" });
				yield* Effect.sleep("50 millis");

				const wasCalled = yield* Ref.get(called);
				expect(wasCalled).toBe(true);
			}),
		);
	});

	it("multiple instances run independently", async () => {
		await runTest(
			Effect.gen(function* () {
				const runner = yield* SpecRunnerInternal;
				const registry = yield* FeatureRegistry;
				const logA: string[] = [];
				const logB: string[] = [];

				// Use a registry that differentiates by an "instance" field in payload
				yield* registry.register("do.work", (payload) =>
					Effect.sync(() => {
						const id = payload.instanceId as string | undefined;
						if (id === "a") logA.push("work");
						else if (id === "b") logB.push("work");
					}),
				);

				yield* runner.registerSpec(SimpleSpec);
				yield* runner.spawn("simple", "a");
				yield* runner.spawn("simple", "b");

				yield* runner.dispatch("a", { _tag: "DoWork", instanceId: "a" });
				yield* runner.dispatch("b", { _tag: "DoWork", instanceId: "b" });
				yield* Effect.sleep("50 millis");

				expect(logA).toEqual(["work"]);
				expect(logB).toEqual(["work"]);
			}),
		);
	});

	it("destroy cleans up instance", async () => {
		await runTest(
			Effect.gen(function* () {
				const runner = yield* SpecRunnerInternal;
				const registry = yield* FeatureRegistry;
				const count = yield* Ref.make(0);

				yield* registry.register("do.work", () =>
					Ref.update(count, (n) => n + 1).pipe(Effect.as(undefined)),
				);

				yield* runner.registerSpec(SimpleSpec);
				yield* runner.spawn("simple", "inst-8");
				yield* runner.dispatch("inst-8", { _tag: "DoWork" });
				yield* Effect.sleep("50 millis");

				const before = yield* Ref.get(count);
				expect(before).toBe(1);

				yield* runner.destroy("simple", "inst-8");
				yield* Effect.sleep("20 millis");

				// Dispatching after destroy should be silently dropped
				yield* runner.dispatch("inst-8", { _tag: "DoWork" });
				yield* Effect.sleep("50 millis");

				const after = yield* Ref.get(count);
				expect(after).toBe(1);
			}),
		);
	});
});
