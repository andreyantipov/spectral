import { type FeatureFn, FeatureRegistry } from "@ctrl/arch.contract.feature-registry";
import { Effect, Layer, Ref } from "effect";

export const FeatureRegistryLive = Layer.effect(
	FeatureRegistry,
	Effect.gen(function* () {
		const store = yield* Ref.make(new Map<string, FeatureFn>());

		return {
			register: (name: string, fn: FeatureFn) => Ref.update(store, (m) => new Map(m).set(name, fn)),

			registerAll: (features: Record<string, FeatureFn>) =>
				Ref.update(store, (m) => {
					const next = new Map(m);
					for (const [k, v] of Object.entries(features)) next.set(k, v);
					return next;
				}),

			execute: (name: string, payload: Record<string, unknown>) =>
				Effect.gen(function* () {
					const m = yield* Ref.get(store);
					const fn = m.get(name);
					if (!fn) return yield* Effect.fail(new Error(`Effect "${name}" not registered`));
					return yield* fn(payload);
				}),

			has: (name: string) => Ref.get(store).pipe(Effect.map((m) => m.has(name))),
		};
	}),
);
