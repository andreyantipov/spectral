import { Context, type Effect } from "effect"

export type SpecEntry = {
  readonly id: string
  readonly version: number
  readonly domain: string
  readonly mode: "instance" | "singleton"
  readonly initial: string
  readonly triggers: readonly string[]
  readonly terminalOn: readonly string[]
  readonly states: Record<string, { on?: Record<string, { target: string; guards?: readonly string[]; effects?: readonly string[] }> }>
}

export class SpecRegistry extends Context.Tag("SpecRegistry")<
  SpecRegistry,
  {
    readonly register: (spec: SpecEntry) => Effect.Effect<void>
    readonly describe: () => Effect.Effect<readonly SpecEntry[]>
  }
>() {}
