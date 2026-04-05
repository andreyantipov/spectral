import { SpecRunner, type Action } from "@ctrl/arch.contract.spec-runner"
import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry"
import { EventJournal } from "@effect/experimental/EventJournal"
import { Context, Effect, FiberMap, Layer, Queue, Ref } from "effect"

// Local spec definition type — runner does NOT import arch.contract.spec
type TransitionDef = {
  readonly target: string
  readonly guards?: ReadonlyArray<string>
  readonly effects?: ReadonlyArray<string>
}

type StateDef = {
  readonly on?: Record<string, TransitionDef>
}

type SpecDef = {
  readonly id: string
  readonly initial: string
  readonly states: Record<string, StateDef>
}

export class SpecRunnerInternal extends Context.Tag("SpecRunnerInternal")<
  SpecRunnerInternal,
  SpecRunner["Type"] & {
    readonly registerSpec: (spec: SpecDef) => Effect.Effect<void>
  }
>() {}

const runInstance = (
  spec: SpecDef,
  instanceId: string,
  queue: Queue.Queue<Action>,
  initialState: string,
) =>
  Effect.gen(function* () {
    const registry = yield* FeatureRegistry
    const journal = yield* EventJournal
    const stateRef = yield* Ref.make(initialState)

    yield* Effect.forever(
      Effect.gen(function* () {
        const action = yield* Queue.take(queue)
        const current = yield* Ref.get(stateRef)
        const stateDef = spec.states[current]
        if (!stateDef?.on) return
        const transition = stateDef.on[action._tag]
        if (!transition) return

        // Guards — execute sequentially, any falsy result drops the action
        if (transition.guards) {
          for (const guard of transition.guards) {
            const result = yield* registry.execute(guard, action as Record<string, unknown>)
            if (!result) return
          }
        }

        // Journal write — state transition + effects run atomically inside
        const payload = new TextEncoder().encode(JSON.stringify(action))
        yield* journal.write({
          event: action._tag,
          primaryKey: instanceId,
          payload,
          effect: () =>
            Effect.gen(function* () {
              yield* Ref.set(stateRef, transition.target)
              if (transition.effects) {
                for (const effectName of transition.effects) {
                  yield* registry.execute(effectName, action as Record<string, unknown>)
                }
              }
            }),
        })
      }),
    )
  })

export const SpecRunnerLive = Layer.scoped(
  SpecRunnerInternal,
  Effect.gen(function* () {
    const fibers = yield* FiberMap.make<string>()
    const specs = yield* Ref.make(new Map<string, SpecDef>())
    const queues = yield* Ref.make(new Map<string, Queue.Queue<Action>>())

    const registerSpec = (spec: SpecDef) =>
      Ref.update(specs, (m) => new Map(m).set(spec.id, spec))

    const spawn = (specId: string, instanceId: string, options?: { initialState?: string }) =>
      Effect.gen(function* () {
        const specMap = yield* Ref.get(specs)
        const spec = specMap.get(specId)
        if (!spec) return yield* Effect.fail(new Error(`Spec "${specId}" not registered`))

        const initial = options?.initialState ?? spec.initial
        const queue = yield* Queue.unbounded<Action>()
        yield* Ref.update(queues, (m) => new Map(m).set(instanceId, queue))

        yield* runInstance(spec, instanceId, queue, initial).pipe(
          FiberMap.run(fibers, instanceId),
        )
      })

    const destroy = (_specId: string, instanceId: string) =>
      Effect.gen(function* () {
        yield* FiberMap.remove(fibers, instanceId)
        const queueMap = yield* Ref.get(queues)
        const queue = queueMap.get(instanceId)
        if (queue) {
          yield* Queue.shutdown(queue)
          yield* Ref.update(queues, (m) => {
            const next = new Map(m)
            next.delete(instanceId)
            return next
          })
        }
      })

    const dispatch = (instanceId: string, action: Action) =>
      Effect.gen(function* () {
        const queueMap = yield* Ref.get(queues)
        const queue = queueMap.get(instanceId)
        if (!queue) return // silently drop if instance doesn't exist
        yield* Queue.offer(queue, action)
      })

    return { spawn, destroy, dispatch, registerSpec }
  }),
)

// Also provide the public SpecRunner tag from the same implementation
export const SpecRunnerPublicLive = SpecRunnerLive.pipe(
  Layer.map((ctx) => {
    const internal = Context.get(ctx, SpecRunnerInternal)
    return Context.make(SpecRunner, {
      spawn: internal.spawn,
      destroy: internal.destroy,
      dispatch: internal.dispatch,
    })
  }),
)
