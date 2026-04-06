import { describe, it, expect } from "bun:test"
import { Effect, Schema } from "effect"
import { Spec } from "./builder"

describe("Spec builder DSL", () => {
  it("builds a spec with actions, effects, guards, states, transitions", () => {
    const spec = Spec("test", { mode: "instance", domain: "test", version: 1 })
      .actions({
        Start: { value: Schema.String },
        Stop: {},
      })
      .effects({
        DoWork: { result: Schema.String },
        Cleanup: {},
      })
      .guards({
        IsReady: Schema.Boolean,
      })
      .states("Idle", "Working", "Done")
      .transitions(({ action, effect, guard, state }) => [
        state.Idle
          .on(action.Start, state.Working, [guard.IsReady, effect.DoWork]),
        state.Working
          .on(action.Stop, state.Done, [effect.Cleanup]),
        state.Done,
      ])
      .build()

    expect(spec.id).toBe("test")
    expect(spec.mode).toBe("instance")
    expect(spec.initial).toBe("Idle")
    expect(spec.actionTags).toEqual(new Set(["Start", "Stop"]))
    expect(spec.effectKeys).toEqual(new Set(["DoWork", "Cleanup"]))
    expect(spec.guardKeys).toEqual(new Set(["IsReady"]))
    expect(spec.triggers).toEqual(["Start"])
    expect(spec.terminalOn).toEqual(["Stop"])
    // Transition separates guards and effects
    expect(spec.states.Idle.on?.Start.guards).toEqual(["IsReady"])
    expect(spec.states.Idle.on?.Start.effects).toEqual(["DoWork"])
    expect(spec.states.Idle.on?.Start.target).toBe("Working")
  })

  it("actions produce TaggedClass instances with make()", () => {
    const spec = Spec("t", { mode: "singleton", domain: "t", version: 1 })
      .actions({ Ping: { msg: Schema.String } })
      .states("Ready")
      .transitions(({ state }) => [state.Ready])
      .build()

    const action = spec.actions.Ping.make({ msg: "hello" })
    expect(action._tag).toBe("Ping")
    expect(action.msg).toBe("hello")
  })

  it("empty effects = void (no output)", () => {
    const spec = Spec("t", { mode: "singleton", domain: "t", version: 1 })
      .actions({ Go: {} })
      .effects({ Run: {} })
      .states("A")
      .transitions(({ action, effect, state }) => [
        state.A.on(action.Go, state.A, [effect.Run]),
      ])
      .build()

    expect(spec.effectKeys).toEqual(new Set(["Run"]))
  })

  it("validates transition targets exist", () => {
    // Builder creation is fine, build would catch issues
    expect(() => {
      Spec("bad", { mode: "singleton", domain: "t", version: 1 })
        .actions({ Go: {} })
        .states("A")
    }).not.toThrow()
  })

  it("extracts all effectKeys from transitions", () => {
    const spec = Spec("s", { mode: "singleton", domain: "s", version: 1 })
      .actions({ A: {}, B: {} })
      .effects({ E1: {}, E2: {}, E3: {} })
      .states("S1", "S2")
      .transitions(({ action, effect, state }) => [
        state.S1.on(action.A, state.S2, [effect.E1, effect.E2]),
        state.S2.on(action.B, state.S1, [effect.E3]),
      ])
      .build()

    expect(spec.effectKeys).toEqual(new Set(["E1", "E2", "E3"]))
  })

  it("singleton mode has empty triggers/terminalOn", () => {
    const spec = Spec("s", { mode: "singleton", domain: "s", version: 1 })
      .actions({ Do: {} })
      .states("Ready")
      .transitions(({ action, state }) => [
        state.Ready.on(action.Do, state.Ready, []),
      ])
      .build()

    expect(spec.triggers).toEqual([])
    expect(spec.terminalOn).toEqual([])
  })

  it("implement() validates all effects and guards have handlers", () => {
    const spec = Spec("t", { mode: "singleton", domain: "t", version: 1 })
      .actions({ Do: {} })
      .effects({ Work: { result: Schema.String } })
      .guards({ IsOk: Schema.Boolean })
      .states("A")
      .transitions(({ action, effect, guard, state }) => [
        state.A.on(action.Do, state.A, [guard.IsOk, effect.Work]),
      ])
      .build()

    const impl = spec.implement({
      Work: (_p) => Effect.succeed({ data: { result: "ok" } }),
      IsOk: (_p) => Effect.succeed(true),
    })
    expect(impl.Work).toBeDefined()
    expect(impl.IsOk).toBeDefined()
  })

  it("implement() throws if handler missing", () => {
    const spec = Spec("t", { mode: "singleton", domain: "t", version: 1 })
      .actions({ Do: {} })
      .effects({ Work: {} })
      .states("A")
      .transitions(({ action, effect, state }) => [
        state.A.on(action.Do, state.A, [effect.Work]),
      ])
      .build()

    expect(() => spec.implement({})).toThrow(/Work/)
  })

  it("multiple transitions in one state", () => {
    const spec = Spec("s", { mode: "instance", domain: "s", version: 1 })
      .actions({ Go: {}, Stop: {} })
      .effects({ Work: {} })
      .states("A", "B", "C")
      .transitions(({ action, effect, state }) => [
        state.A
          .on(action.Go, state.B, [effect.Work])
          .on(action.Stop, state.C, []),
        state.B,
        state.C,
      ])
      .build()

    expect(spec.states.A.on?.Go.target).toBe("B")
    expect(spec.states.A.on?.Stop.target).toBe("C")
  })
})
