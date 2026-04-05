import { Context, type Effect } from "effect"

export type FeatureFn = (payload: Record<string, unknown>) => Effect.Effect<unknown, unknown>

export class FeatureRegistry extends Context.Tag("FeatureRegistry")<
  FeatureRegistry,
  {
    readonly register: (name: string, fn: FeatureFn) => Effect.Effect<void>
    readonly registerAll: (features: Record<string, FeatureFn>) => Effect.Effect<void>
    readonly execute: (name: string, payload: Record<string, unknown>) => Effect.Effect<unknown, unknown>
    readonly has: (name: string) => Effect.Effect<boolean>
  }
>() {}
