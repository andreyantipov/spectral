import { Context, type Effect } from "effect"

export type Action = { readonly _tag: string; readonly [key: string]: unknown }

export class SpecRunner extends Context.Tag("SpecRunner")<
  SpecRunner,
  {
    readonly spawn: (specId: string, instanceId: string, options?: { initialState?: string }) => Effect.Effect<void>
    readonly destroy: (specId: string, instanceId: string) => Effect.Effect<void>
    readonly dispatch: (instanceId: string, action: Action) => Effect.Effect<void>
  }
>() {}
