import { Context, type Effect } from "effect";

/** Result returned by feature effects. SpecRunner reads data/emit after execution. */
export type EffectResult = {
	readonly data?: Record<string, unknown>;
	readonly emit?: Record<string, unknown>;
};

export type FeatureFn = (
	payload: Record<string, unknown>,
) => Effect.Effect<EffectResult | void, unknown>;

export class FeatureRegistry extends Context.Tag("FeatureRegistry")<
	FeatureRegistry,
	{
		readonly register: (name: string, fn: FeatureFn) => Effect.Effect<void>;
		readonly registerAll: (features: Record<string, FeatureFn>) => Effect.Effect<void>;
		readonly execute: (
			name: string,
			payload: Record<string, unknown>,
		) => Effect.Effect<unknown, unknown>;
		readonly has: (name: string) => Effect.Effect<boolean>;
	}
>() {}
