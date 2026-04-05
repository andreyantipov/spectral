import { describe, it, expect } from "bun:test"
import { Schema } from "effect"
import { FsmSpecSchema, type FsmSpec } from "./spec"

describe("FsmSpecSchema", () => {
  it("validates a correct instance spec", () => {
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
    expect(result.mode).toBe("instance")
  })

  it("validates a singleton spec", () => {
    const spec: FsmSpec = {
      id: "mgr", version: 1, domain: "mgr", mode: "singleton",
      initial: "ready", triggers: [], terminalOn: [],
      states: { ready: {} },
    }
    expect(Schema.decodeUnknownSync(FsmSpecSchema)(spec).mode).toBe("singleton")
  })

  it("rejects missing required fields", () => {
    expect(() => Schema.decodeUnknownSync(FsmSpecSchema)({ id: "bad" })).toThrow()
  })

  it("rejects invalid mode", () => {
    expect(() => Schema.decodeUnknownSync(FsmSpecSchema)({
      id: "t", version: 1, domain: "d", mode: "invalid",
      initial: "s", triggers: [], terminalOn: [], states: { s: {} },
    })).toThrow()
  })

  it("is JSON serializable", () => {
    const spec: FsmSpec = {
      id: "test", version: 1, domain: "test", mode: "instance",
      initial: "idle", triggers: [], terminalOn: [],
      states: { idle: { on: { Go: { target: "idle", guards: ["check"], effects: ["do"] } } } },
    }
    const json = JSON.parse(JSON.stringify(spec))
    expect(json.states.idle.on.Go.guards).toEqual(["check"])
    expect(json.states.idle.on.Go.effects).toEqual(["do"])
  })

  it("supports transitions with guards, effects, and compensate", () => {
    const spec: FsmSpec = {
      id: "t", version: 1, domain: "d", mode: "instance",
      initial: "a", triggers: [], terminalOn: [],
      states: {
        a: { on: { X: { target: "b", guards: ["g1"], effects: ["e1"], compensate: ["c1"] } } },
        b: {},
      },
    }
    const result = Schema.decodeUnknownSync(FsmSpecSchema)(spec)
    expect(result.states.a.on?.X.compensate).toEqual(["c1"])
  })
})
