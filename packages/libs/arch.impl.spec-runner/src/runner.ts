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
  readonly onCreate?: ReadonlyArray<string>
  readonly onRestore?: ReadonlyArray<string>
  readonly onDestroy?: ReadonlyArray<string>
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

    console.info(`[SpecRunner] runInstance STARTED: ${spec.id} instance=${instanceId.slice(0, 8)} state=${initialState}`)

    yield* Effect.forever(
      Effect.gen(function* () {
        const action = yield* Queue.take(queue)
        const current = yield* Ref.get(stateRef)
        const stateDef = spec.states[current]
        if (!stateDef?.on) {
          console.info(`[SpecRunner] ${instanceId.slice(0, 8)}: state "${current}" has no transitions, dropping ${action._tag}`)
          return
        }
        const transition = stateDef.on[action._tag]
        if (!transition) {
          console.info(`[SpecRunner] ${instanceId.slice(0, 8)}: no transition for ${action._tag} in state "${current}"`)
          return
        }

        // Guards — execute sequentially, any falsy result drops the action
        if (transition.guards) {
          for (const guard of transition.guards) {
            const result = yield* registry.execute(guard, action as Record<string, unknown>)
            if (!result) {
              console.info(`[SpecRunner] ${instanceId.slice(0, 8)}: guard "${guard}" blocked ${action._tag}`)
              return
            }
          }
        }

        console.info(`[SpecRunner] ${instanceId.slice(0, 8)}: transitioning ${current} → ${transition.target} (${action._tag})`)

        // Journal write — state transition + effects run atomically inside
        const previous = current
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
                  console.info(`[SpecRunner] ${instanceId.slice(0, 8)}: executing effect "${effectName}"`)
                  yield* registry.execute(effectName, action as Record<string, unknown>)
                }
              }
            }),
        }).pipe(
          Effect.catchAll((err) => {
            console.error(`[SpecRunner] ${instanceId.slice(0, 8)}: journal.write FAILED for ${action._tag}:`, err)
            return Effect.void
          }),
        )

        console.info(`[SpecRunner] ${instanceId.slice(0, 8)}: transition complete ${previous} → ${transition.target}`)
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
        if (!spec) {
          console.error(`[SpecRunner] spawn failed: spec "${specId}" not registered`)
          return yield* Effect.fail(new Error(`Spec "${specId}" not registered`))
        }

        const isRestore = options?.initialState !== undefined
        const initial = options?.initialState ?? spec.initial
        console.info(`[SpecRunner] spawn: ${specId} instance=${instanceId.slice(0, 8)} state=${initial} ${isRestore ? "(restore)" : "(new)"}`)

        const queue = yield* Queue.unbounded<Action>()
        yield* Ref.update(queues, (m) => new Map(m).set(instanceId, queue))

        // Lifecycle: onCreate or onRestore
        const lifecycleHooks = isRestore ? spec.onRestore : spec.onCreate
        if (lifecycleHooks) {
          const registry = yield* FeatureRegistry
          for (const effectName of lifecycleHooks) {
            yield* registry.execute(effectName, { instanceId, specId } as Record<string, unknown>).pipe(
              Effect.catchAll((err) => {
                console.error(`[SpecRunner] lifecycle ${isRestore ? "onRestore" : "onCreate"} effect "${effectName}" failed:`, err)
                return Effect.void
              }),
            )
          }
        }

        yield* runInstance(spec, instanceId, queue, initial).pipe(
          FiberMap.run(fibers, instanceId),
        )
      })

    const destroy = (specId: string, instanceId: string) =>
      Effect.gen(function* () {
        // Lifecycle: onDestroy
        const specMap = yield* Ref.get(specs)
        const spec = specMap.get(specId)
        if (spec?.onDestroy) {
          const registry = yield* FeatureRegistry
          for (const effectName of spec.onDestroy) {
            yield* registry.execute(effectName, { instanceId, specId } as Record<string, unknown>).pipe(
              Effect.catchAll((err) => {
                console.error(`[SpecRunner] onDestroy effect "${effectName}" failed:`, err)
                return Effect.void
              }),
            )
          }
        }

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
        if (!queue) {
          console.info(`[SpecRunner] dispatch dropped: no instance ${instanceId.slice(0, 8)} for ${action._tag}`)
          return
        }
        console.info(`[SpecRunner] dispatch: ${action._tag} → ${instanceId.slice(0, 8)}`)
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
