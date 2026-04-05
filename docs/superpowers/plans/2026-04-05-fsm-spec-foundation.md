# FSM-Spec Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement FSM-spec architecture foundation and migrate browser domain (session + navigation + history) as proof of concept. CreateSession → Navigate → UrlCommitted → title update — full flow through FSM.

**Architecture:** Five namespaces (`arch → base → feature → ui → wire`). SpecRunner interprets declarative FSM specs. Features are flat effect maps called only through SpecRunner. EventJournal is source of truth — `journal.write()` records transition + executes effects atomically.

**Tech Stack:** Effect.ts 3.19, @effect/experimental (EventLog, EventJournal), @effect/sql-drizzle/Sqlite with libsql, Electrobun, SolidJS, Bun

**Spec:** `docs/superpowers/specs/2026-04-05-fsm-spec-architecture.md`

**Worktree:** `.worktrees/fsm-spec` on branch `arch/fsm-spec-foundation`

---

## File Structure

### New packages:

```
packages/libs/arch.contract.spec/
packages/libs/arch.contract.spec-runner/
packages/libs/arch.contract.spec-registry/
packages/libs/arch.contract.feature-registry/
packages/libs/arch.impl.spec-runner/
packages/libs/arch.impl.spec-registry/
packages/libs/arch.impl.feature-registry/
packages/libs/arch.utils.spec-builder/
packages/libs/base.model.session/
packages/libs/base.model.error/
packages/libs/base.op.browsing/
packages/libs/base.spec.web-session/
packages/libs/feature.browser.session/
packages/libs/feature.browser.navigation/
packages/libs/feature.browser.history/
```

### Packages to modify:

```
packages/libs/wire.desktop.main/   — replace WebBrowsingServiceLive with spec registration
```

### Packages to remove (browser domain):

```
packages/libs/domain.service.browsing/  — replaced by SpecRunner + WebSessionSpec
```

### Packages unchanged in this PR:

```
packages/libs/core.impl.event-bus/      — stays, EventBus = transport
packages/libs/core.impl.ipc-bridge/     — stays, IPC = transport
packages/libs/core.middleware.otel/     — stays
packages/libs/core.middleware.mcp/      — stays
packages/libs/domain.service.workspace/ — migrated in follow-up PR
packages/libs/domain.service.system/    — migrated in follow-up PR
packages/libs/ui.*                      — unchanged this PR
```

---

## Task 1: arch.contract.spec — FsmSpec type

**Files:**
- Create: `packages/libs/arch.contract.spec/package.json`
- Create: `packages/libs/arch.contract.spec/tsconfig.json`
- Create: `packages/libs/arch.contract.spec/src/spec.ts`
- Create: `packages/libs/arch.contract.spec/src/index.ts`
- Test: `packages/libs/arch.contract.spec/src/spec.test.ts`

- [ ] **Step 1: Create package scaffolding**

```json
{
  "name": "@ctrl/arch.contract.spec",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "effect": "workspace:*" },
  "scripts": { "check": "tsc --noEmit", "test": "bun test" }
}
```

```json
{ "extends": "../../../tsconfig.json", "include": ["src"] }
```

- [ ] **Step 2: Write FsmSpec test**

```ts
// src/spec.test.ts
import { describe, it, expect } from "bun:test"
import { Schema } from "effect"
import { FsmSpecSchema, type FsmSpec } from "./spec"

describe("FsmSpecSchema", () => {
  it("validates a correct spec", () => {
    const spec: FsmSpec = {
      id: "test", version: 1, domain: "test", mode: "instance",
      initial: "idle", triggers: ["Start"], terminalOn: ["Stop"],
      states: {
        idle: { on: { Start: { target: "running", effects: ["do.something"] } } },
        running: { on: { Stop: { target: "stopped" } } },
        stopped: {},
      },
    }
    const result = Schema.decodeUnknownSync(FsmSpecSchema)(spec)
    expect(result.id).toBe("test")
  })

  it("rejects missing required fields", () => {
    expect(() => Schema.decodeUnknownSync(FsmSpecSchema)({ id: "bad" })).toThrow()
  })

  it("accepts singleton mode", () => {
    const spec: FsmSpec = {
      id: "mgr", version: 1, domain: "mgr", mode: "singleton",
      initial: "ready", triggers: [], terminalOn: [],
      states: { ready: {} },
    }
    expect(Schema.decodeUnknownSync(FsmSpecSchema)(spec).mode).toBe("singleton")
  })

  it("is JSON serializable", () => {
    const spec: FsmSpec = {
      id: "test", version: 1, domain: "test", mode: "instance",
      initial: "idle", triggers: [], terminalOn: [],
      states: { idle: { on: { Go: { target: "idle", guards: ["check"], effects: ["do"] } } } },
    }
    const json = JSON.parse(JSON.stringify(spec))
    expect(json.states.idle.on.Go.guards).toEqual(["check"])
  })
})
```

- [ ] **Step 3: Run test — expect FAIL (module not found)**

Run: `cd .worktrees/fsm-spec && bun test packages/libs/arch.contract.spec/src/spec.test.ts`

- [ ] **Step 4: Implement FsmSpec type**

```ts
// src/spec.ts
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
})

export type FsmSpec = typeof FsmSpecSchema.Type
export type Transition = typeof TransitionSchema.Type
export type StateNode = typeof StateNodeSchema.Type
```

```ts
// src/index.ts
export { FsmSpecSchema, type FsmSpec, type Transition, type StateNode } from "./spec"
```

- [ ] **Step 5: Run test — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/libs/arch.contract.spec/
git commit -m "arch: add arch.contract.spec — FsmSpec type and schema"
```

---

## Task 2: arch.contract interfaces — spec-runner, spec-registry, feature-registry

**Files:**
- Create: `packages/libs/arch.contract.spec-runner/package.json`
- Create: `packages/libs/arch.contract.spec-runner/tsconfig.json`
- Create: `packages/libs/arch.contract.spec-runner/src/runner.ts`
- Create: `packages/libs/arch.contract.spec-runner/src/index.ts`
- Create: `packages/libs/arch.contract.spec-registry/` (same pattern)
- Create: `packages/libs/arch.contract.feature-registry/` (same pattern)

- [ ] **Step 1: Create arch.contract.spec-runner**

```ts
// src/runner.ts
import { Context, type Effect } from "effect"

export class SpecRunner extends Context.Tag("SpecRunner")<
  SpecRunner,
  {
    readonly spawn: (specId: string, instanceId: string, options?: { initialState?: string }) => Effect.Effect<void>
    readonly destroy: (specId: string, instanceId: string) => Effect.Effect<void>
    readonly dispatch: (instanceId: string, action: { readonly _tag: string; readonly [key: string]: unknown }) => Effect.Effect<void>
  }
>() {}
```

- [ ] **Step 2: Create arch.contract.spec-registry**

```ts
// src/registry.ts
import { Context, type Effect } from "effect"

export type SpecEntry = {
  readonly id: string
  readonly version: number
  readonly domain: string
  readonly mode: "instance" | "singleton"
  readonly initial: string
  readonly triggers: readonly string[]
  readonly terminalOn: readonly string[]
  readonly states: Record<string, { on?: Record<string, { target: string; guards?: string[]; effects?: string[] }> }>
}

export class SpecRegistry extends Context.Tag("SpecRegistry")<
  SpecRegistry,
  {
    readonly register: (spec: SpecEntry) => Effect.Effect<void>
    readonly describe: () => Effect.Effect<readonly SpecEntry[]>
  }
>() {}
```

Note: `SpecEntry` duplicates `FsmSpec` shape but does not import from `arch.contract.spec`. No cross-imports between contracts.

- [ ] **Step 3: Create arch.contract.feature-registry**

```ts
// src/registry.ts
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
```

- [ ] **Step 4: Verify all three compile**

Run: `cd .worktrees/fsm-spec && bun build packages/libs/arch.contract.spec-runner/src/index.ts --no-bundle`

- [ ] **Step 5: Commit**

```bash
git add packages/libs/arch.contract.spec-runner/ packages/libs/arch.contract.spec-registry/ packages/libs/arch.contract.feature-registry/
git commit -m "arch: add spec-runner, spec-registry, feature-registry contracts"
```

---

## Task 3: arch.utils.spec-builder — builder DSL

**Files:**
- Create: `packages/libs/arch.utils.spec-builder/package.json`
- Create: `packages/libs/arch.utils.spec-builder/tsconfig.json`
- Create: `packages/libs/arch.utils.spec-builder/src/builder.ts`
- Create: `packages/libs/arch.utils.spec-builder/src/index.ts`
- Test: `packages/libs/arch.utils.spec-builder/src/builder.test.ts`

- [ ] **Step 1: Write builder test**

```ts
// src/builder.test.ts
import { describe, it, expect } from "bun:test"
import { Schema } from "effect"
import { Spec } from "./builder"

class Start extends Schema.TaggedClass<Start>()("Start", { instanceId: Schema.String }) {}
class Stop extends Schema.TaggedClass<Stop>()("Stop", { instanceId: Schema.String }) {}
class DoWork extends Schema.TaggedClass<DoWork>()("DoWork", { instanceId: Schema.String }) {}

describe("Spec.make builder", () => {
  it("builds a valid spec object", () => {
    const spec = Spec.make("test-spec", { mode: "instance", domain: "test", version: 1 })
      .initial("idle")
      .triggers(Start)
      .terminalOn(Stop)
      .state("idle", (s) => s.on(DoWork, "working", { effects: ["do.work"] }))
      .state("working", (s) => s.on(Stop, "stopped"))
      .state("stopped")
      .build()

    expect(spec.id).toBe("test-spec")
    expect(spec.initial).toBe("idle")
    expect(spec.triggers).toEqual(["Start"])
    expect(spec.terminalOn).toEqual(["Stop"])
    expect(spec.states.idle.on?.DoWork.target).toBe("working")
    expect(spec.states.idle.on?.DoWork.effects).toEqual(["do.work"])
  })

  it("is JSON serializable", () => {
    const spec = Spec.make("s", { mode: "singleton", domain: "d", version: 1 })
      .initial("ready")
      .triggers(Start)
      .terminalOn(Stop)
      .state("ready", (s) => s.on(DoWork, "ready", { guards: ["check"], effects: ["do"] }))
      .build()
    const json = JSON.parse(JSON.stringify(spec))
    expect(json.states.ready.on.DoWork.guards).toEqual(["check"])
  })

  it("validates initial state exists", () => {
    expect(() =>
      Spec.make("bad", { mode: "instance", domain: "d", version: 1 })
        .initial("nonexistent")
        .triggers(Start).terminalOn(Stop)
        .state("idle")
        .build()
    ).toThrow(/initial.*nonexistent/)
  })

  it("validates transition targets exist", () => {
    expect(() =>
      Spec.make("bad", { mode: "instance", domain: "d", version: 1 })
        .initial("idle")
        .triggers(Start).terminalOn(Stop)
        .state("idle", (s) => s.on(DoWork, "nonexistent"))
        .build()
    ).toThrow(/nonexistent/)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement builder**

```ts
// src/builder.ts
type TaggedClass = { readonly _tag: string }
type TransitionConfig = { guards?: string[]; effects?: string[]; compensate?: string[] }

type Transition = {
  target: string
  guards?: string[]
  effects?: string[]
  compensate?: string[]
}

type StateNode = { on?: Record<string, Transition> }

type FsmSpec = {
  id: string
  version: number
  domain: string
  mode: "instance" | "singleton"
  initial: string
  triggers: string[]
  terminalOn: string[]
  states: Record<string, StateNode>
}

class StateBuilder {
  private transitions: Record<string, Transition> = {}

  on(action: TaggedClass, target: string, config?: TransitionConfig): this {
    this.transitions[action._tag] = {
      target,
      guards: config?.guards,
      effects: config?.effects,
      compensate: config?.compensate,
    }
    return this
  }

  _build(): StateNode {
    return Object.keys(this.transitions).length > 0 ? { on: this.transitions } : {}
  }
}

class SpecBuilder {
  private _initial = ""
  private _triggers: string[] = []
  private _terminalOn: string[] = []
  private _states: Record<string, StateNode> = {}

  constructor(
    private _id: string,
    private _config: { mode: "instance" | "singleton"; domain: string; version: number },
  ) {}

  initial(state: string): this { this._initial = state; return this }

  triggers(...actions: TaggedClass[]): this {
    this._triggers.push(...actions.map((a) => a._tag)); return this
  }

  terminalOn(...actions: TaggedClass[]): this {
    this._terminalOn.push(...actions.map((a) => a._tag)); return this
  }

  state(name: string, configure?: (s: StateBuilder) => StateBuilder): this {
    const builder = new StateBuilder()
    if (configure) configure(builder)
    this._states[name] = builder._build()
    return this
  }

  build(): FsmSpec {
    const stateNames = new Set(Object.keys(this._states))

    if (!stateNames.has(this._initial)) {
      throw new Error(`Initial state "${this._initial}" not found in states: ${[...stateNames].join(", ")}`)
    }

    for (const [stateName, stateNode] of Object.entries(this._states)) {
      if (stateNode.on) {
        for (const [action, transition] of Object.entries(stateNode.on)) {
          if (!stateNames.has(transition.target)) {
            throw new Error(`State "${stateName}" action "${action}" targets unknown state "${transition.target}"`)
          }
        }
      }
    }

    return {
      id: this._id,
      version: this._config.version,
      domain: this._config.domain,
      mode: this._config.mode,
      initial: this._initial,
      triggers: this._triggers,
      terminalOn: this._terminalOn,
      states: this._states,
    }
  }
}

export const Spec = {
  make: (id: string, config: { mode: "instance" | "singleton"; domain: string; version: number }) =>
    new SpecBuilder(id, config),
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/libs/arch.utils.spec-builder/
git commit -m "arch: add arch.utils.spec-builder — Spec.make() DSL with build-time validation"
```

---

## Task 4: arch.impl.feature-registry

**Files:**
- Create: `packages/libs/arch.impl.feature-registry/package.json`
- Create: `packages/libs/arch.impl.feature-registry/tsconfig.json`
- Create: `packages/libs/arch.impl.feature-registry/src/feature-registry.ts`
- Create: `packages/libs/arch.impl.feature-registry/src/index.ts`
- Test: `packages/libs/arch.impl.feature-registry/src/feature-registry.test.ts`

- [ ] **Step 1: Write test**

```ts
// src/feature-registry.test.ts
import { describe, it, expect } from "bun:test"
import { Effect } from "effect"
import { FeatureRegistryLive } from "./feature-registry"
import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry"

describe("FeatureRegistry", () => {
  const run = <A>(effect: Effect.Effect<A, unknown, FeatureRegistry>) =>
    Effect.runPromise(effect.pipe(Effect.provide(FeatureRegistryLive)))

  it("registers and executes an effect", async () => {
    const result = await run(Effect.gen(function* () {
      const reg = yield* FeatureRegistry
      yield* reg.register("test.effect", (p) => Effect.succeed(p.value))
      return yield* reg.execute("test.effect", { value: 42 })
    }))
    expect(result).toBe(42)
  })

  it("fails for unknown effect", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const reg = yield* FeatureRegistry
        return yield* reg.execute("unknown", {})
      }).pipe(Effect.provide(FeatureRegistryLive), Effect.either)
    )
    expect(result._tag).toBe("Left")
  })

  it("registerAll registers multiple effects", async () => {
    const result = await run(Effect.gen(function* () {
      const reg = yield* FeatureRegistry
      yield* reg.registerAll({
        "a": () => Effect.succeed("aa"),
        "b": () => Effect.succeed("bb"),
      })
      const a = yield* reg.execute("a", {})
      const b = yield* reg.execute("b", {})
      return { a, b }
    }))
    expect(result).toEqual({ a: "aa", b: "bb" })
  })

  it("has() returns correct value", async () => {
    const result = await run(Effect.gen(function* () {
      const reg = yield* FeatureRegistry
      yield* reg.register("exists", () => Effect.void)
      return { yes: yield* reg.has("exists"), no: yield* reg.has("nope") }
    }))
    expect(result).toEqual({ yes: true, no: false })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/feature-registry.ts
import { FeatureRegistry, type FeatureFn } from "@ctrl/arch.contract.feature-registry"
import { Effect, Layer, Ref } from "effect"

export const FeatureRegistryLive = Layer.effect(
  FeatureRegistry,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, FeatureFn>())

    return {
      register: (name, fn) =>
        Ref.update(store, (m) => new Map(m).set(name, fn)),

      registerAll: (features) =>
        Ref.update(store, (m) => {
          const next = new Map(m)
          for (const [k, v] of Object.entries(features)) next.set(k, v)
          return next
        }),

      execute: (name, payload) =>
        Effect.gen(function* () {
          const m = yield* Ref.get(store)
          const fn = m.get(name)
          if (!fn) return yield* Effect.fail(new Error(`Effect "${name}" not registered`))
          return yield* fn(payload)
        }),

      has: (name) => Ref.get(store).pipe(Effect.map((m) => m.has(name))),
    }
  }),
)
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/libs/arch.impl.feature-registry/
git commit -m "arch: add arch.impl.feature-registry — Ref<Map> implementation"
```

---

## Task 5: arch.impl.spec-runner — the core FSM runner

**Files:**
- Create: `packages/libs/arch.impl.spec-runner/package.json`
- Create: `packages/libs/arch.impl.spec-runner/tsconfig.json`
- Create: `packages/libs/arch.impl.spec-runner/src/runner.ts`
- Create: `packages/libs/arch.impl.spec-runner/src/index.ts`
- Test: `packages/libs/arch.impl.spec-runner/src/runner.test.ts`

Dependencies: `@ctrl/arch.contract.spec-runner`, `@ctrl/arch.contract.feature-registry`, `@effect/experimental` (EventJournal), `effect`

- [ ] **Step 1: Write runner test**

```ts
// src/runner.test.ts
import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { EventJournal } from "@effect/experimental/EventJournal"
import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry"
import { FeatureRegistryLive } from "@ctrl/arch.impl.feature-registry"
import { SpecRunnerLive } from "./runner"

const TestSpec = {
  id: "test", version: 1, domain: "test", mode: "instance" as const,
  initial: "idle", triggers: ["Start"], terminalOn: ["Stop"],
  states: {
    idle: { on: { DoWork: { target: "working", effects: ["do.work"] } } },
    working: { on: {
      DoMore: { target: "working", effects: ["do.more"] },
      Stop: { target: "stopped" },
    } },
    stopped: {},
  },
}

const GuardSpec = {
  id: "guard-test", version: 1, domain: "test", mode: "instance" as const,
  initial: "idle", triggers: ["Start"], terminalOn: [],
  states: {
    idle: { on: { Go: { target: "active", guards: ["is.allowed"], effects: ["do.thing"] } } },
    active: {},
  },
}

describe("SpecRunner", () => {
  const TestLayer = SpecRunnerLive.pipe(
    Layer.provide(FeatureRegistryLive),
    Layer.provide(EventJournal.layerMemory),
  )

  it("processes action through transition and calls effect", async () => {
    const log: string[] = []
    await Effect.gen(function* () {
      const reg = yield* FeatureRegistry
      yield* reg.register("do.work", (p) => { log.push("worked:" + p.instanceId); return Effect.void })

      const runner = yield* SpecRunnerLive.tag
      yield* runner.registerSpec(TestSpec)
      yield* runner.spawn("test", "i1")
      yield* runner.dispatch("i1", { _tag: "DoWork", instanceId: "i1" })
      yield* Effect.sleep("50 millis")
    }).pipe(Effect.provide(TestLayer), Effect.scoped, Effect.runPromise)

    expect(log).toContain("worked:i1")
  })

  it("drops action when no transition exists", async () => {
    const log: string[] = []
    await Effect.gen(function* () {
      const reg = yield* FeatureRegistry
      yield* reg.register("do.work", () => { log.push("bad"); return Effect.void })

      const runner = yield* SpecRunnerLive.tag
      yield* runner.registerSpec(TestSpec)
      yield* runner.spawn("test", "i1")
      yield* runner.dispatch("i1", { _tag: "Stop", instanceId: "i1" }) // Stop not valid from idle
      yield* Effect.sleep("50 millis")
    }).pipe(Effect.provide(TestLayer), Effect.scoped, Effect.runPromise)

    expect(log).toEqual([])
  })

  it("advances through multiple states", async () => {
    const log: string[] = []
    await Effect.gen(function* () {
      const reg = yield* FeatureRegistry
      yield* reg.register("do.work", () => { log.push("work"); return Effect.void })
      yield* reg.register("do.more", () => { log.push("more"); return Effect.void })

      const runner = yield* SpecRunnerLive.tag
      yield* runner.registerSpec(TestSpec)
      yield* runner.spawn("test", "i1")

      yield* runner.dispatch("i1", { _tag: "DoWork", instanceId: "i1" })
      yield* Effect.sleep("50 millis")
      yield* runner.dispatch("i1", { _tag: "DoMore", instanceId: "i1" })
      yield* Effect.sleep("50 millis")
      yield* runner.dispatch("i1", { _tag: "Stop", instanceId: "i1" })
      yield* Effect.sleep("50 millis")
    }).pipe(Effect.provide(TestLayer), Effect.scoped, Effect.runPromise)

    expect(log).toEqual(["work", "more"])
  })

  it("guard blocks transition when returns false", async () => {
    const log: string[] = []
    await Effect.gen(function* () {
      const reg = yield* FeatureRegistry
      yield* reg.register("is.allowed", () => Effect.succeed(false))
      yield* reg.register("do.thing", () => { log.push("done"); return Effect.void })

      const runner = yield* SpecRunnerLive.tag
      yield* runner.registerSpec(GuardSpec)
      yield* runner.spawn("guard-test", "i1")
      yield* runner.dispatch("i1", { _tag: "Go", instanceId: "i1" })
      yield* Effect.sleep("50 millis")
    }).pipe(Effect.provide(TestLayer), Effect.scoped, Effect.runPromise)

    expect(log).toEqual([])
  })

  it("guard allows transition when returns true", async () => {
    const log: string[] = []
    await Effect.gen(function* () {
      const reg = yield* FeatureRegistry
      yield* reg.register("is.allowed", () => Effect.succeed(true))
      yield* reg.register("do.thing", () => { log.push("done"); return Effect.void })

      const runner = yield* SpecRunnerLive.tag
      yield* runner.registerSpec(GuardSpec)
      yield* runner.spawn("guard-test", "i1")
      yield* runner.dispatch("i1", { _tag: "Go", instanceId: "i1" })
      yield* Effect.sleep("50 millis")
    }).pipe(Effect.provide(TestLayer), Effect.scoped, Effect.runPromise)

    expect(log).toEqual(["done"])
  })

  it("writes transitions to EventJournal", async () => {
    await Effect.gen(function* () {
      const reg = yield* FeatureRegistry
      yield* reg.register("do.work", () => Effect.void)

      const runner = yield* SpecRunnerLive.tag
      yield* runner.registerSpec(TestSpec)
      yield* runner.spawn("test", "i1")
      yield* runner.dispatch("i1", { _tag: "DoWork", instanceId: "i1" })
      yield* Effect.sleep("50 millis")

      const journal = yield* EventJournal
      const entries = yield* journal.entries
      expect(entries.length).toBeGreaterThan(0)
      expect(entries.some((e) => e.event === "DoWork")).toBe(true)
    }).pipe(Effect.provide(TestLayer), Effect.scoped, Effect.runPromise)
  })

  it("multiple instances run independently", async () => {
    const log: string[] = []
    await Effect.gen(function* () {
      const reg = yield* FeatureRegistry
      yield* reg.register("do.work", (p) => { log.push(p.instanceId as string); return Effect.void })

      const runner = yield* SpecRunnerLive.tag
      yield* runner.registerSpec(TestSpec)
      yield* runner.spawn("test", "i1")
      yield* runner.spawn("test", "i2")
      yield* runner.dispatch("i1", { _tag: "DoWork", instanceId: "i1" })
      yield* runner.dispatch("i2", { _tag: "DoWork", instanceId: "i2" })
      yield* Effect.sleep("50 millis")
    }).pipe(Effect.provide(TestLayer), Effect.scoped, Effect.runPromise)

    expect(log.sort()).toEqual(["i1", "i2"])
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement SpecRunner**

Core implementation using Ref + Queue + FiberMap + EventJournal.write():

```ts
// src/runner.ts
import { SpecRunner } from "@ctrl/arch.contract.spec-runner"
import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry"
import { EventJournal } from "@effect/experimental/EventJournal"
import { Effect, FiberMap, Layer, Queue, Ref, Schema } from "effect"

type FsmSpec = {
  readonly id: string
  readonly mode: "instance" | "singleton"
  readonly initial: string
  readonly states: Record<string, {
    on?: Record<string, { target: string; guards?: string[]; effects?: string[] }>
  }>
  readonly [key: string]: unknown
}

type Action = { readonly _tag: string; readonly [key: string]: unknown }

const runInstance = (
  spec: FsmSpec,
  instanceId: string,
  initialState: string,
  features: FeatureRegistry["Type"],
  journal: EventJournal["Type"],
  queue: Queue.Queue<Action>,
) =>
  Effect.gen(function* () {
    const state = yield* Ref.make(initialState)

    yield* Effect.forever(
      Effect.gen(function* () {
        const action = yield* Queue.take(queue)
        const current = yield* Ref.get(state)
        const transition = spec.states[current]?.on?.[action._tag]

        if (!transition) return

        // Guards
        if (transition.guards) {
          for (const guard of transition.guards) {
            const passed = yield* features.execute(guard, action as Record<string, unknown>)
            if (!passed) return
          }
        }

        // Write to journal + execute effects atomically
        yield* journal.write({
          event: action._tag,
          primaryKey: instanceId,
          payload: yield* Schema.encode(Schema.Unknown)(action),
          effect: () =>
            Effect.gen(function* () {
              yield* Ref.set(state, transition.target)
              yield* Effect.forEach(
                transition.effects ?? [],
                (name) => features.execute(name, action as Record<string, unknown>),
                { concurrency: 1 },
              )
            }),
        })
      })
    )
  })

export const SpecRunnerLive = Layer.scoped(
  SpecRunner,
  Effect.gen(function* () {
    const features = yield* FeatureRegistry
    const journal = yield* EventJournal
    const fiberMap = yield* FiberMap.make<string>()
    const queues = new Map<string, Queue.Queue<Action>>()
    const specs = new Map<string, FsmSpec>()

    const registerSpec = (spec: FsmSpec) =>
      Effect.sync(() => { specs.set(spec.id, spec) })

    const spawn = (specId: string, instanceId: string, options?: { initialState?: string }) =>
      Effect.gen(function* () {
        const spec = specs.get(specId)
        if (!spec) return yield* Effect.fail(new Error(`Spec "${specId}" not registered`))
        const queue = yield* Queue.unbounded<Action>()
        queues.set(instanceId, queue)
        const initial = options?.initialState ?? spec.initial
        yield* FiberMap.run(fiberMap, instanceId, runInstance(spec, instanceId, initial, features, journal, queue))
      })

    const dispatch = (instanceId: string, action: Action) =>
      Effect.gen(function* () {
        const queue = queues.get(instanceId)
        if (queue) yield* Queue.offer(queue, action)
      })

    const destroy = (_specId: string, instanceId: string) =>
      Effect.gen(function* () {
        yield* FiberMap.remove(fiberMap, instanceId)
        queues.delete(instanceId)
      })

    return { spawn, destroy, dispatch, registerSpec } as SpecRunner["Type"] & { registerSpec: (spec: FsmSpec) => Effect.Effect<void> }
  }),
)

export { SpecRunner } from "@ctrl/arch.contract.spec-runner"
```

Note: `registerSpec` is an internal method used by SpecRegistry, not part of the public SpecRunner contract. The public interface only has spawn/destroy/dispatch.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/libs/arch.impl.spec-runner/
git commit -m "arch: add arch.impl.spec-runner — FSM runner with Ref + Queue + FiberMap + EventJournal"
```

---

## Task 6: base.model + base.op — business types and actions

**Files:**
- Create: `packages/libs/base.model.session/` — Session, Page schemas (extract from `base.schema`)
- Create: `packages/libs/base.model.error/` — DatabaseError, ValidationError (extract from `base.error`)
- Create: `packages/libs/base.op.browsing/` — action schemas + effect constants
- Test: `packages/libs/base.op.browsing/src/actions.test.ts`

- [ ] **Step 1: Create base.model.session**

Extract Session and Page from `packages/libs/base.schema/src/session.ts` into new package.

- [ ] **Step 2: Create base.model.error**

Extract DatabaseError, ValidationError from `packages/libs/base.error/src/index.ts`.

- [ ] **Step 3: Write actions test**

```ts
// packages/libs/base.op.browsing/src/actions.test.ts
import { describe, it, expect } from "bun:test"
import { CreateSession, Navigate, UrlCommitted, CloseSession, TitleChanged } from "./index"
import { Effects } from "./index"

describe("browsing actions", () => {
  it("CreateSession.make() works without new", () => {
    const a = CreateSession.make({ mode: "visual" })
    expect(a._tag).toBe("CreateSession")
    expect(a.mode).toBe("visual")
  })

  it("Navigate has instanceId and url", () => {
    const a = Navigate.make({ instanceId: "t1", url: "https://google.com" })
    expect(a._tag).toBe("Navigate")
    expect(a.instanceId).toBe("t1")
    expect(a.url).toBe("https://google.com")
  })

  it("UrlCommitted has all fields", () => {
    const a = UrlCommitted.make({ instanceId: "t1", url: "u", title: "t", favicon: "f" })
    expect(a._tag).toBe("UrlCommitted")
  })

  it("actions are JSON serializable", () => {
    const a = Navigate.make({ instanceId: "t1", url: "https://google.com" })
    const json = JSON.parse(JSON.stringify(a))
    expect(json._tag).toBe("Navigate")
    expect(json.url).toBe("https://google.com")
  })

  it("Effects constants are all strings", () => {
    expect(typeof Effects.NAV_START).toBe("string")
    expect(typeof Effects.SESSION_CREATE).toBe("string")
    expect(typeof Effects.HISTORY_RECORD).toBe("string")
  })
})
```

- [ ] **Step 4: Run test — expect FAIL**

- [ ] **Step 5: Implement actions**

```ts
// src/session-actions.ts
import { Schema } from "effect"

export class CreateSession extends Schema.TaggedClass<CreateSession>()("CreateSession", {
  mode: Schema.Literal("visual"),
}) {}

export class CloseSession extends Schema.TaggedClass<CloseSession>()("CloseSession", {
  instanceId: Schema.String,
}) {}

export class ActivateSession extends Schema.TaggedClass<ActivateSession>()("ActivateSession", {
  instanceId: Schema.String,
}) {}
```

```ts
// src/navigation-actions.ts
import { Schema } from "effect"

export class Navigate extends Schema.TaggedClass<Navigate>()("Navigate", {
  instanceId: Schema.String,
  url: Schema.String,
}) {}

export class UrlCommitted extends Schema.TaggedClass<UrlCommitted>()("UrlCommitted", {
  instanceId: Schema.String,
  url: Schema.String,
  title: Schema.String,
  favicon: Schema.String,
}) {}

export class TitleChanged extends Schema.TaggedClass<TitleChanged>()("TitleChanged", {
  instanceId: Schema.String,
  title: Schema.String,
}) {}

export class NavigationFailed extends Schema.TaggedClass<NavigationFailed>()("NavigationFailed", {
  instanceId: Schema.String,
  error: Schema.String,
}) {}
```

```ts
// src/effects.ts
export const Effects = {
  NAV_START: "nav.start",
  NAV_CANCEL: "nav.cancel",
  SESSION_CREATE: "session.create",
  SESSION_CLOSE: "session.close",
  SESSION_UPDATE_URL: "session.updateUrl",
  SESSION_UPDATE_TITLE: "session.updateTitle",
  SESSION_UPDATE_FAVICON: "session.updateFavicon",
  SESSION_SET_ERROR: "session.setError",
  HISTORY_RECORD: "history.record",
  URL_IS_VALID: "url.isValid",
} as const
```

- [ ] **Step 6: Run test — expect PASS**

- [ ] **Step 7: Commit**

```bash
git add packages/libs/base.model.session/ packages/libs/base.model.error/ packages/libs/base.op.browsing/
git commit -m "arch: add base.model.session, base.model.error, base.op.browsing"
```

---

## Task 7: base.spec.web-session — first FSM spec

**Files:**
- Create: `packages/libs/base.spec.web-session/package.json`
- Create: `packages/libs/base.spec.web-session/tsconfig.json`
- Create: `packages/libs/base.spec.web-session/src/web-session.ts`
- Create: `packages/libs/base.spec.web-session/src/index.ts`
- Test: `packages/libs/base.spec.web-session/src/web-session.test.ts`

- [ ] **Step 1: Write spec test**

```ts
// src/web-session.test.ts
import { describe, it, expect } from "bun:test"
import { Schema } from "effect"
import { FsmSpecSchema } from "@ctrl/arch.contract.spec"
import { WebSessionSpec } from "./web-session"
import { Effects } from "@ctrl/base.op.browsing"

describe("WebSessionSpec", () => {
  it("validates against FsmSpecSchema", () => {
    const validated = Schema.decodeUnknownSync(FsmSpecSchema)(WebSessionSpec)
    expect(validated.id).toBe("web-session")
    expect(validated.mode).toBe("instance")
  })

  it("is JSON serializable", () => {
    const json = JSON.parse(JSON.stringify(WebSessionSpec))
    expect(json.states.idle.on.Navigate.target).toBe("loading")
  })

  it("has correct initial and lifecycle", () => {
    expect(WebSessionSpec.initial).toBe("idle")
    expect(WebSessionSpec.triggers).toContain("CreateSession")
    expect(WebSessionSpec.terminalOn).toContain("CloseSession")
  })

  it("Navigate from idle has url.isValid guard", () => {
    expect(WebSessionSpec.states.idle.on?.Navigate.guards).toContain(Effects.URL_IS_VALID)
  })

  it("UrlCommitted triggers history.record", () => {
    expect(WebSessionSpec.states.loading.on?.UrlCommitted.effects).toContain(Effects.HISTORY_RECORD)
  })

  it("CloseSession from browsing triggers session.close", () => {
    expect(WebSessionSpec.states.browsing.on?.CloseSession.effects).toContain(Effects.SESSION_CLOSE)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement using builder**

```ts
// src/web-session.ts
import { Spec } from "@ctrl/arch.utils.spec-builder"
import {
  CreateSession, CloseSession, Navigate, UrlCommitted,
  TitleChanged, NavigationFailed,
} from "@ctrl/base.op.browsing"
import { Effects } from "@ctrl/base.op.browsing"

export const WebSessionSpec = Spec.make("web-session", {
  mode: "instance", domain: "session", version: 1,
})
  .initial("idle")
  .triggers(CreateSession)
  .terminalOn(CloseSession)
  .state("idle", (s) => s
    .on(Navigate, "loading", {
      guards: [Effects.URL_IS_VALID],
      effects: [Effects.NAV_START],
    })
  )
  .state("loading", (s) => s
    .on(UrlCommitted, "browsing", {
      effects: [
        Effects.SESSION_UPDATE_URL,
        Effects.SESSION_UPDATE_TITLE,
        Effects.SESSION_UPDATE_FAVICON,
        Effects.HISTORY_RECORD,
      ],
    })
    .on(NavigationFailed, "error", {
      effects: [Effects.SESSION_SET_ERROR],
    })
  )
  .state("browsing", (s) => s
    .on(Navigate, "loading", {
      guards: [Effects.URL_IS_VALID],
      effects: [Effects.NAV_START],
    })
    .on(TitleChanged, "browsing", {
      effects: [Effects.SESSION_UPDATE_TITLE],
    })
    .on(CloseSession, "closed", {
      effects: [Effects.SESSION_CLOSE],
    })
  )
  .state("error", (s) => s
    .on(Navigate, "loading", { effects: [Effects.NAV_START] })
    .on(CloseSession, "closed")
  )
  .state("closed")
  .build()
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/libs/base.spec.web-session/
git commit -m "arch: add base.spec.web-session — browser session FSM spec"
```

---

## Task 8: feature.browser.* — browsing effects

**Files:**
- Create: `packages/libs/feature.browser.session/` — session effects + Drizzle schema
- Create: `packages/libs/feature.browser.navigation/` — navigation effects + guards
- Create: `packages/libs/feature.browser.history/` — history effects + Drizzle schema
- Test: `packages/libs/feature.browser.session/src/effects.test.ts`

Dependencies: `@ctrl/arch.contract.feature-registry`, `@ctrl/base.op.browsing`, `@effect/sql-drizzle`, `effect`

- [ ] **Step 1: Create feature.browser.session with Drizzle schema**

Move `sessionsTable` and `pagesTable` from `core.impl.db/src/model/` into feature package:

```ts
// src/schema.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const sessionsTable = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  mode: text("mode").notNull().default("visual"),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(false),
  currentIndex: integer("currentIndex").notNull().default(0),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
})

export const pagesTable = sqliteTable("pages", {
  id: text("id").primaryKey(),
  sessionId: text("sessionId").notNull(),
  url: text("url").notNull(),
  title: text("title").notNull().default(""),
  pageIndex: integer("pageIndex").notNull(),
  loadedAt: text("loadedAt").notNull(),
})
```

- [ ] **Step 2: Implement session effects**

```ts
// src/effects.ts
import { Effects } from "@ctrl/base.op.browsing"
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite"
import { Effect } from "effect"
import { eq } from "drizzle-orm"
import { sessionsTable, pagesTable } from "./schema"

export const sessionEffects = Effect.gen(function* () {
  const db = yield* SqliteDrizzle

  return {
    [Effects.SESSION_CREATE]: (p: Record<string, unknown>) =>
      Effect.gen(function* () {
        const id = p.instanceId as string
        const mode = (p.mode as string) ?? "visual"
        const now = new Date().toISOString()
        yield* db.insert(sessionsTable).values({
          id, mode, isActive: true, currentIndex: 0,
          createdAt: now, updatedAt: now,
        })
      }),

    [Effects.SESSION_CLOSE]: (p: Record<string, unknown>) =>
      Effect.gen(function* () {
        yield* db.delete(sessionsTable).where(eq(sessionsTable.id, p.instanceId as string))
      }),

    [Effects.SESSION_UPDATE_URL]: (p: Record<string, unknown>) =>
      Effect.gen(function* () {
        const id = p.instanceId as string
        const url = p.url as string
        const now = new Date().toISOString()
        yield* db.insert(pagesTable).values({
          id: crypto.randomUUID(), sessionId: id,
          url, title: "", pageIndex: 0, loadedAt: now,
        })
        yield* db.update(sessionsTable).set({ updatedAt: now }).where(eq(sessionsTable.id, id))
      }),

    [Effects.SESSION_UPDATE_TITLE]: (p: Record<string, unknown>) =>
      Effect.gen(function* () {
        const id = p.instanceId as string
        const title = p.title as string
        yield* db.update(sessionsTable).set({ updatedAt: new Date().toISOString() }).where(eq(sessionsTable.id, id))
      }),

    [Effects.SESSION_UPDATE_FAVICON]: (_p: Record<string, unknown>) =>
      Effect.void, // favicon stored in page metadata, not in sessions table

    [Effects.SESSION_SET_ERROR]: (_p: Record<string, unknown>) =>
      Effect.void, // TODO: error state tracking
  }
})
```

- [ ] **Step 3: Write test with in-memory DB**

```ts
// src/effects.test.ts
import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite"
import { LibsqlClient } from "@effect/sql-libsql"
import { sessionEffects } from "./effects"
import { sessionsTable } from "./schema"
import { Effects } from "@ctrl/base.op.browsing"
import { eq } from "drizzle-orm"
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite"

const TestDbLayer = LibsqlClient.layer({ url: ":memory:" }).pipe(
  Layer.provideMerge(drizzleLayer),
)

describe("session effects", () => {
  it("SESSION_CREATE inserts a session", async () => {
    await Effect.gen(function* () {
      const db = yield* SqliteDrizzle
      // Create tables (in test, manually run SQL)
      yield* Effect.tryPromise(() =>
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'visual',
          isActive INTEGER NOT NULL DEFAULT 0, currentIndex INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
        )`)
      )

      const effects = yield* sessionEffects
      yield* effects[Effects.SESSION_CREATE]({ instanceId: "t1", mode: "visual" })

      const rows = yield* db.select().from(sessionsTable).where(eq(sessionsTable.id, "t1"))
      expect(rows.length).toBe(1)
      expect(rows[0].id).toBe("t1")
    }).pipe(Effect.provide(TestDbLayer), Effect.runPromise)
  })
})
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Implement navigation effects**

```ts
// feature.browser.navigation/src/effects.ts
import { Effects } from "@ctrl/base.op.browsing"
import { Effect } from "effect"

export const navigationEffects = Effect.succeed({
  [Effects.NAV_START]: (p: Record<string, unknown>) =>
    Effect.void, // Navigation is handled by native webview, this is a no-op on main process

  [Effects.NAV_CANCEL]: (_p: Record<string, unknown>) =>
    Effect.void,

  [Effects.URL_IS_VALID]: (p: Record<string, unknown>) =>
    Effect.succeed(
      typeof p.url === "string" &&
      (p.url.startsWith("http://") || p.url.startsWith("https://") || p.url === "about:blank")
    ),
})
```

- [ ] **Step 6: Implement history effects**

```ts
// feature.browser.history/src/effects.ts + schema.ts
// Similar pattern: Drizzle schema for history table + history.record effect
```

- [ ] **Step 7: Commit**

```bash
git add packages/libs/feature.browser.session/ packages/libs/feature.browser.navigation/ packages/libs/feature.browser.history/
git commit -m "feat: add feature.browser.* — session, navigation, history effects"
```

---

## Task 9: arch.impl.spec-registry — auto-routing from specs

**Files:**
- Create: `packages/libs/arch.impl.spec-registry/package.json`
- Create: `packages/libs/arch.impl.spec-registry/tsconfig.json`
- Create: `packages/libs/arch.impl.spec-registry/src/spec-registry.ts`
- Create: `packages/libs/arch.impl.spec-registry/src/index.ts`
- Test: `packages/libs/arch.impl.spec-registry/src/spec-registry.test.ts`

SpecRegistry subscribes to EventBus. When a trigger action arrives, it spawns a new instance. When a terminalOn action arrives, it destroys. All other actions routed by instanceId.

- [ ] **Step 1: Write test**

Test: register spec, dispatch trigger action via EventBus → instance spawned → dispatch action → effect called.

- [ ] **Step 2: Implement SpecRegistry**

Subscribes to `bus.commands`, routes based on spec metadata (triggers/terminalOn/instanceId).

- [ ] **Step 3: Run test — expect PASS**

- [ ] **Step 4: Commit**

```bash
git add packages/libs/arch.impl.spec-registry/
git commit -m "arch: add arch.impl.spec-registry — auto-routing from spec triggers/terminalOn"
```

---

## Task 10: wire.desktop.main — FSM wiring + remove WebBrowsingServiceLive

**Files:**
- Modify: `packages/libs/wire.desktop.main/src/index.ts`

- [ ] **Step 1: Add FSM imports and registration**

```ts
import { WebSessionSpec } from "@ctrl/base.spec.web-session"
import { sessionEffects } from "@ctrl/feature.browser.session"
import { navigationEffects } from "@ctrl/feature.browser.navigation"
import { historyEffects } from "@ctrl/feature.browser.history"
import { SpecRegistry } from "@ctrl/arch.contract.spec-registry"
import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry"

// In createMainProcess — replace BrowsingServiceLayer with:
const SpecEngineLive = Layer.mergeAll(
  SpecRunnerLive,
  SpecRegistryLive,
  FeatureRegistryLive,
).pipe(Layer.provide(EventBusLive), Layer.provide(JournalLive))

// Register features
yield* FeatureRegistry.pipe(Effect.flatMap((reg) =>
  Effect.all([
    reg.registerAll(yield* sessionEffects),
    reg.registerAll(yield* navigationEffects),
    reg.registerAll(yield* historyEffects),
  ])
))

// Register specs — routing automatic
yield* SpecRegistry.pipe(Effect.flatMap((reg) =>
  reg.register(WebSessionSpec)
))
```

- [ ] **Step 2: Remove WebBrowsingServiceLive from ServicesLive**

Remove `BrowsingServiceLayer` from `Layer.mergeAll(...)`. Keep WorkspaceServiceLayer and SystemServiceLayer (migrated in follow-up PRs).

- [ ] **Step 3: Integration test — full flow**

```ts
// packages/libs/wire.desktop.main/src/integration.test.ts
import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { EventBus } from "@ctrl/core.contract.event-bus"
import { EventBusLive } from "@ctrl/core.impl.event-bus"
import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry"
import { SpecRegistry } from "@ctrl/arch.contract.spec-registry"

describe("FSM integration", () => {
  it("CreateSession → Navigate → UrlCommitted full flow", async () => {
    await Effect.gen(function* () {
      const bus = yield* EventBus
      const features = yield* FeatureRegistry

      // Dispatch CreateSession
      yield* bus.send({
        type: "command", action: "CreateSession",
        payload: { mode: "visual" },
        meta: { source: "ui" },
      })
      yield* Effect.sleep("100 millis")

      // Verify session created in DB
      // ...

      // Dispatch Navigate
      // Dispatch UrlCommitted
      // Verify title updated
    }).pipe(Effect.provide(IntegrationTestLayer), Effect.scoped, Effect.runPromise)
  })
})
```

- [ ] **Step 4: Build verification**

Run: `cd .worktrees/fsm-spec && bun run build --force`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/libs/wire.desktop.main/
git commit -m "arch: wire FSM spec-engine, replace WebBrowsingServiceLive"
```

---

## Task 11: ast-grep rules — namespace dependency enforcement

**Files:**
- Create: `.ast-grep/rules/namespace-arch-isolation.yml`
- Create: `.ast-grep/rules/namespace-base-isolation.yml`
- Create: `.ast-grep/rules/namespace-feature-isolation.yml`
- Create: `.ast-grep/rules/namespace-no-cross-tier-imports.yml`

- [ ] **Step 1: arch cannot import base/feature/ui/wire**

- [ ] **Step 2: base cannot import feature/ui/wire**

- [ ] **Step 3: feature cannot import ui/wire**

- [ ] **Step 4: No cross-imports within same tier**

`arch.contract.X` cannot import `arch.contract.Y`, `feature.browser.X` cannot import `feature.browser.Y`, etc.

- [ ] **Step 5: Run ast-grep scan**

Run: `cd .worktrees/fsm-spec && ast-grep scan`
Expected: No violations in new packages

- [ ] **Step 6: Commit**

```bash
git add .ast-grep/rules/
git commit -m "arch: add ast-grep rules for a→b→f→u→w namespace enforcement"
```

---

## Summary

| Task | Package(s) | What |
|------|-----------|------|
| 1 | arch.contract.spec | FsmSpec type + Schema |
| 2 | arch.contract.{spec-runner,spec-registry,feature-registry} | Interfaces |
| 3 | arch.utils.spec-builder | Builder DSL |
| 4 | arch.impl.feature-registry | Ref<Map> implementation |
| 5 | arch.impl.spec-runner | FSM runner with journal.write() |
| 6 | base.model.{session,error} + base.op.browsing | Business types + actions |
| 7 | base.spec.web-session | First FSM spec |
| 8 | feature.browser.{session,navigation,history} | Effects + Drizzle schemas |
| 9 | arch.impl.spec-registry | Auto-routing from EventBus |
| 10 | wire.desktop.main | FSM wiring, remove old service |
| 11 | .ast-grep/rules | Dependency enforcement |

**Deferred to follow-up PRs:**
- `base.spec.bookmark-manager` + `feature.browser.bookmarks` — bookmark domain migration
- `base.spec.workspace-manager` + `feature.workspace.*` — workspace domain migration
- `base.spec.runtime-manager` — app startup/restore
- `base.op.workspace`, `base.op.system` — remaining action schemas
- Compensation/rollback in SpecRunner
- Loro integration
- Rename existing core/domain packages to arch/feature
