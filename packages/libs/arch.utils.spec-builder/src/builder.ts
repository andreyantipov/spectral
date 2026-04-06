import { Schema } from "effect"
import type {
  BuiltSpec,
  StateNode,
  Transition,
} from "@ctrl/arch.contract.spec"

// ---------------------------------------------------------------------------
// Ref types — returned by the transition callback's destructured helpers
// ---------------------------------------------------------------------------

type ActionRef = { readonly _kind: "action"; readonly name: string; readonly _tag: string }
type EffectRef = { readonly _kind: "effect"; readonly name: string }
type GuardRef = { readonly _kind: "guard"; readonly name: string }
type PipelineItem = EffectRef | GuardRef

type StateRef = {
  readonly _kind: "state"
  readonly name: string
  readonly _transitions: ReadonlyArray<{
    action: string
    target: string
    guards: string[]
    effects: string[]
  }>
  on(action: ActionRef, target: StateRef, pipeline?: PipelineItem[]): StateRef
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const makeStateRef = (
  name: string,
  transitions: ReadonlyArray<{
    action: string
    target: string
    guards: string[]
    effects: string[]
  }> = [],
): StateRef => ({
  _kind: "state",
  name,
  _transitions: transitions,
  on(action: ActionRef, target: StateRef, pipeline: PipelineItem[] = []) {
    const guards: string[] = []
    const effects: string[] = []
    for (const item of pipeline) {
      if (item._kind === "guard") guards.push(item.name)
      else effects.push(item.name)
    }
    return makeStateRef(name, [
      ...transitions,
      { action: action.name, target: target.name, guards, effects },
    ])
  },
})

const makeActionRef = (name: string): ActionRef => ({
  _kind: "action",
  name,
  _tag: name,
})

const makeEffectRef = (name: string): EffectRef => ({
  _kind: "effect",
  name,
})

const makeGuardRef = (name: string): GuardRef => ({
  _kind: "guard",
  name,
})

// ---------------------------------------------------------------------------
// SpecConfig
// ---------------------------------------------------------------------------

type SpecConfig = {
  mode: "instance" | "singleton"
  domain: string
  version: number
}

// ---------------------------------------------------------------------------
// Internal accumulated data — immutable, passed through builder chain
// ---------------------------------------------------------------------------

type BuilderData = {
  readonly id: string
  readonly config: SpecConfig
  readonly actionDefs: Record<string, Record<string, Schema.Schema.All>>
  readonly effectDefs: Record<string, Record<string, Schema.Schema.All>>
  readonly guardDefs: Record<string, Schema.Schema.All>
  readonly stateNames: readonly string[]
  readonly transitionFn:
    | ((refs: {
        action: Record<string, ActionRef>
        effect: Record<string, EffectRef>
        guard: Record<string, GuardRef>
        state: Record<string, StateRef>
      }) => StateRef[])
    | undefined
}

// ---------------------------------------------------------------------------
// Builder — immutable fluent chain
// ---------------------------------------------------------------------------

const makeBuilder = (data: BuilderData) => ({
  actions<A extends Record<string, Record<string, Schema.Schema.All>>>(actionDefs: A) {
    return makeBuilder({ ...data, actionDefs: actionDefs as Record<string, Record<string, Schema.Schema.All>> })
  },

  effects<E extends Record<string, Record<string, Schema.Schema.All>>>(effectDefs: E) {
    return makeBuilder({ ...data, effectDefs: effectDefs as Record<string, Record<string, Schema.Schema.All>> })
  },

  guards<G extends Record<string, Schema.Schema.All>>(guardDefs: G) {
    return makeBuilder({ ...data, guardDefs: guardDefs as Record<string, Schema.Schema.All> })
  },

  states(...names: string[]) {
    return makeBuilder({ ...data, stateNames: names })
  },

  transitions(
    fn: (refs: {
      action: Record<string, ActionRef>
      effect: Record<string, EffectRef>
      guard: Record<string, GuardRef>
      state: Record<string, StateRef>
    }) => StateRef[],
  ) {
    return makeBuilder({ ...data, transitionFn: fn })
  },

  build(): BuiltSpec {
    const { id, config, actionDefs, effectDefs, guardDefs, stateNames, transitionFn } = data

    // --- Build action TaggedClasses ---
    const actions: Record<string, { readonly _tag: string; make: (props: unknown) => unknown }> = {}
    for (const [name, fields] of Object.entries(actionDefs)) {
      const schemaClass = Schema.TaggedClass<any>()(name, fields)
      actions[name] = {
        _tag: name,
        make: (props: unknown) => new (schemaClass as any)(props),
      }
    }

    // --- Build refs for transitions callback ---
    const actionRefs: Record<string, ActionRef> = {}
    for (const name of Object.keys(actionDefs)) {
      actionRefs[name] = makeActionRef(name)
    }

    const effectRefs: Record<string, EffectRef> = {}
    for (const name of Object.keys(effectDefs)) {
      effectRefs[name] = makeEffectRef(name)
    }

    const guardRefs: Record<string, GuardRef> = {}
    for (const name of Object.keys(guardDefs)) {
      guardRefs[name] = makeGuardRef(name)
    }

    const stateRefs: Record<string, StateRef> = {}
    for (const name of stateNames) {
      stateRefs[name] = makeStateRef(name)
    }

    // --- Execute transitions callback ---
    const stateResults = transitionFn
      ? transitionFn({ action: actionRefs, effect: effectRefs, guard: guardRefs, state: stateRefs })
      : []

    // --- Build state nodes from transition results ---
    const states: Record<string, StateNode> = {}
    const allEffectKeys = new Set<string>()
    const allGuardKeys = new Set<string>()
    const allActionTags = new Set<string>()

    // First, register all declared states
    for (const name of stateNames) {
      states[name] = {}
    }

    // Collect terminal state names (states that appear in results with no transitions)
    const statesWithTransitions = new Set<string>()

    // Then overlay transitions from results
    for (const stateRef of stateResults) {
      if (stateRef._transitions.length > 0) {
        statesWithTransitions.add(stateRef.name)
        const on: Record<string, Transition> = {}
        for (const t of stateRef._transitions) {
          allActionTags.add(t.action)
          for (const e of t.effects) allEffectKeys.add(e)
          for (const g of t.guards) allGuardKeys.add(g)

          const transition: Transition = { target: t.target }
          if (t.guards.length > 0) (transition as any).guards = t.guards
          if (t.effects.length > 0) (transition as any).effects = t.effects
          on[t.action] = transition
        }
        states[stateRef.name] = { on }
      }
    }

    // --- Validate ---
    const initial = stateNames[0]
    if (initial === undefined) {
      throw new Error("Spec: at least one state required")
    }

    for (const [stateName, stateNode] of Object.entries(states)) {
      if (stateNode.on === undefined) continue
      for (const [eventTag, transition] of Object.entries(stateNode.on)) {
        if (!(transition.target in states)) {
          throw new Error(
            `Spec: transition target "${transition.target}" in state "${stateName}" on "${eventTag}" does not exist in [${Object.keys(states).join(", ")}]`,
          )
        }
      }
    }

    // --- Auto-detect triggers and terminalOn ---
    const terminalStateNames = new Set(
      stateNames.filter((name) => !statesWithTransitions.has(name)),
    )

    let triggers: string[] = []
    let terminalOn: string[] = []

    if (config.mode === "instance") {
      // triggers = actions from initial state's transitions
      const initialNode = states[initial]
      if (initialNode?.on) {
        triggers = Object.keys(initialNode.on)
      }

      // terminalOn = actions that transition TO terminal states
      for (const [_stateName, stateNode] of Object.entries(states)) {
        if (stateNode.on === undefined) continue
        for (const [actionTag, transition] of Object.entries(stateNode.on)) {
          if (terminalStateNames.has(transition.target)) {
            if (!terminalOn.includes(actionTag)) {
              terminalOn.push(actionTag)
            }
          }
        }
      }
    }

    // --- Collect all declared keys (not just used in transitions) ---
    for (const name of Object.keys(effectDefs)) allEffectKeys.add(name)
    for (const name of Object.keys(guardDefs)) allGuardKeys.add(name)
    for (const name of Object.keys(actionDefs)) allActionTags.add(name)

    return {
      id,
      version: config.version,
      domain: config.domain,
      mode: config.mode,
      initial,
      triggers,
      terminalOn,
      states,
      effectKeys: allEffectKeys,
      emitKeys: new Set<string>(),
      guardKeys: allGuardKeys,
      actionTags: allActionTags,
      actions,
      implement: (handlers: Record<string, (...args: never) => unknown>) => {
        const missing: string[] = []
        for (const key of allEffectKeys) {
          if (!(key in handlers)) missing.push(key)
        }
        for (const key of allGuardKeys) {
          if (!(key in handlers)) missing.push(key)
        }
        if (missing.length > 0) {
          throw new Error(`implement(): missing handlers for: ${missing.join(", ")}`)
        }
        return handlers
      },
    }
  },
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const Spec = (id: string, config: SpecConfig) =>
  makeBuilder({
    id,
    config,
    actionDefs: {},
    effectDefs: {},
    guardDefs: {},
    stateNames: [],
    transitionFn: undefined,
  })
