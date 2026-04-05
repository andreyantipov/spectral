type TaggedClass = { readonly _tag: string }

type TransitionConfig = {
  guards?: string[]
  effects?: string[]
  compensate?: string[]
}

type Transition = {
  target: string
  guards?: string[]
  effects?: string[]
  compensate?: string[]
}

type StateNode = { on?: Record<string, Transition> }

type BuiltSpec = {
  id: string
  version: number
  domain: string
  mode: "instance" | "singleton"
  initial: string
  triggers: string[]
  terminalOn: string[]
  states: Record<string, StateNode>
}

type SpecConfig = {
  mode: "instance" | "singleton"
  domain: string
  version: number
}

class StateBuilder {
  private _on: Record<string, Transition> = {}

  on(taggedClass: TaggedClass, target: string, config?: TransitionConfig): this {
    const transition: Transition = { target }
    if (config?.guards !== undefined) transition.guards = config.guards
    if (config?.effects !== undefined) transition.effects = config.effects
    if (config?.compensate !== undefined) transition.compensate = config.compensate
    this._on[taggedClass._tag] = transition
    return this
  }

  build(): StateNode {
    if (Object.keys(this._on).length === 0) return {}
    return { on: { ...this._on } }
  }
}

class SpecBuilder {
  private _initial: string | undefined = undefined
  private _triggers: string[] = []
  private _terminalOn: string[] = []
  private _states: Record<string, StateNode> = {}

  constructor(
    private readonly _id: string,
    private readonly _config: SpecConfig,
  ) {}

  initial(state: string): this {
    this._initial = state
    return this
  }

  triggers(...taggedClasses: TaggedClass[]): this {
    this._triggers = taggedClasses.map((t) => t._tag)
    return this
  }

  terminalOn(...taggedClasses: TaggedClass[]): this {
    this._terminalOn = taggedClasses.map((t) => t._tag)
    return this
  }

  state(name: string, configureFn?: (s: StateBuilder) => StateBuilder): this {
    const sb = new StateBuilder()
    if (configureFn !== undefined) {
      configureFn(sb)
    }
    this._states[name] = sb.build()
    return this
  }

  build(): BuiltSpec {
    if (this._initial === undefined) {
      throw new Error("SpecBuilder: initial state not set")
    }

    if (!(this._initial in this._states)) {
      throw new Error(
        `SpecBuilder: initial state "${this._initial}" does not exist in states [${Object.keys(this._states).join(", ")}]`,
      )
    }

    for (const [stateName, stateNode] of Object.entries(this._states)) {
      if (stateNode.on === undefined) continue
      for (const [eventTag, transition] of Object.entries(stateNode.on)) {
        if (!(transition.target in this._states)) {
          throw new Error(
            `SpecBuilder: transition target "${transition.target}" in state "${stateName}" on event "${eventTag}" does not exist in states [${Object.keys(this._states).join(", ")}]`,
          )
        }
      }
    }

    return {
      id: this._id,
      version: this._config.version,
      domain: this._config.domain,
      mode: this._config.mode,
      initial: this._initial,
      triggers: [...this._triggers],
      terminalOn: [...this._terminalOn],
      states: { ...this._states },
    }
  }
}

export const Spec = {
  make: (id: string, config: SpecConfig): SpecBuilder => new SpecBuilder(id, config),
}
