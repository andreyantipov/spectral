import { Schema } from "effect"

export const TransitionSchema = Schema.Struct({
  target: Schema.String,
  guards: Schema.optional(Schema.Array(Schema.String)),
  effects: Schema.optional(Schema.Array(Schema.String)),
  compensate: Schema.optional(Schema.Array(Schema.String)),
})

export const StateNodeSchema = Schema.Struct({
  on: Schema.optional(Schema.Record({ key: Schema.String, value: TransitionSchema })),
})

export const FsmSpecSchema = Schema.Struct({
  id: Schema.String,
  version: Schema.Number,
  domain: Schema.String,
  mode: Schema.Literal("instance", "singleton"),
  initial: Schema.String,
  triggers: Schema.Array(Schema.String),
  terminalOn: Schema.Array(Schema.String),
  states: Schema.Record({ key: Schema.String, value: StateNodeSchema }),
  onCreate: Schema.optional(Schema.Array(Schema.String)),
  onRestore: Schema.optional(Schema.Array(Schema.String)),
  onDestroy: Schema.optional(Schema.Array(Schema.String)),
})

export type FsmSpec = typeof FsmSpecSchema.Type
export type Transition = typeof TransitionSchema.Type
export type StateNode = typeof StateNodeSchema.Type
