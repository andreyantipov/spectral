import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry";
import type { Spec } from "@ctrl/arch.contract.spec";
import { type Action, SpecRunner } from "@ctrl/arch.contract.spec-runner";
import { Context, Effect, FiberMap, Layer, Queue, Ref } from "effect";

export class SpecRunnerInternal extends Context.Tag("SpecRunnerInternal")<
	SpecRunnerInternal,
	SpecRunner["Type"] & {
		readonly registerSpec: (spec: Spec) => Effect.Effect<void>;
	}
>() {}

const runInstance = (
	spec: Spec,
	instanceId: string,
	queue: Queue.Queue<Action>,
	initialState: string,
	registry: FeatureRegistry["Type"],
) =>
	Effect.gen(function* () {
		const stateRef = yield* Ref.make(initialState);

		yield* Effect.forever(
			Effect.gen(function* () {
				const action = yield* Queue.take(queue);
				const current = yield* Ref.get(stateRef);
				const stateDef = spec.states[current];
				if (!stateDef?.on) return;
				const transition = stateDef.on[action._tag];
				if (!transition) return;

				// Guards — sequential, any falsy → drop
				if (transition.guards) {
					for (const guard of transition.guards) {
						const result = yield* registry.execute(guard, action as Record<string, unknown>);
						if (!result) return;
					}
				}

				// Transition: set state + run effects
				yield* Ref.set(stateRef, transition.target);
				if (transition.effects) {
					for (const effectName of transition.effects) {
						yield* registry.execute(effectName, action as Record<string, unknown>);
					}
				}
			}),
		);
	});

export const SpecRunnerLive = Layer.scoped(
	SpecRunnerInternal,
	Effect.gen(function* () {
		const registry = yield* FeatureRegistry;
		const fibers = yield* FiberMap.make<string>();
		const specs = yield* Ref.make(new Map<string, Spec>());
		const queues = yield* Ref.make(new Map<string, Queue.Queue<Action>>());

		const registerSpec = (spec: Spec) => Ref.update(specs, (m) => new Map(m).set(spec.id, spec));

		const spawn = (specId: string, instanceId: string, options?: { initialState?: string }) =>
			Effect.gen(function* () {
				const specMap = yield* Ref.get(specs);
				const spec = specMap.get(specId);
				if (!spec) {
					yield* Effect.logError(`spawn failed: spec "${specId}" not registered`);
					return;
				}

				const initial = options?.initialState ?? spec.initial;
				yield* Effect.logInfo(
					`spawn: ${specId} instance=${instanceId.slice(0, 8)} state=${initial}`,
				);

				const queue = yield* Queue.unbounded<Action>();
				yield* Ref.update(queues, (m) => new Map(m).set(instanceId, queue));

				// Lifecycle: onStart
				if (spec.onStart) {
					for (const effectName of spec.onStart) {
						yield* registry
							.execute(effectName, { instanceId, specId } as Record<string, unknown>)
							.pipe(
								Effect.catchAll((err) =>
									Effect.logError(`onStart effect "${effectName}" failed: ${err}`),
								),
							);
					}
				}

				yield* runInstance(spec, instanceId, queue, initial, registry).pipe(
					FiberMap.run(fibers, instanceId),
				);
			}).pipe(Effect.catchAll((err) => Effect.logError(`spawn error: ${err}`)));

		const destroy = (specId: string, instanceId: string) =>
			Effect.gen(function* () {
				// Lifecycle: onStop
				const specMap = yield* Ref.get(specs);
				const spec = specMap.get(specId);
				if (spec?.onStop) {
					for (const effectName of spec.onStop) {
						yield* registry
							.execute(effectName, { instanceId, specId } as Record<string, unknown>)
							.pipe(
								Effect.catchAll((err) =>
									Effect.logError(`onStop effect "${effectName}" failed: ${err}`),
								),
							);
					}
				}

				yield* FiberMap.remove(fibers, instanceId);
				const queueMap = yield* Ref.get(queues);
				const queue = queueMap.get(instanceId);
				if (queue) {
					yield* Queue.shutdown(queue);
					yield* Ref.update(queues, (m) => {
						const next = new Map(m);
						next.delete(instanceId);
						return next;
					});
				}
			});

		const dispatch = (instanceId: string, action: Action) =>
			Effect.gen(function* () {
				const queueMap = yield* Ref.get(queues);
				const queue = queueMap.get(instanceId);
				if (!queue) {
					yield* Effect.logWarning(
						`dispatch dropped: no instance ${instanceId.slice(0, 8)} for ${action._tag}`,
					);
					return;
				}
				yield* Effect.logDebug(`dispatch: ${action._tag} → ${instanceId.slice(0, 8)}`);
				yield* Queue.offer(queue, action);
			});

		return { spawn, destroy, dispatch, registerSpec };
	}),
);

// Also provide the public SpecRunner tag from the same implementation
export const SpecRunnerPublicLive = SpecRunnerLive.pipe(
	Layer.map((ctx) => {
		const internal = Context.get(ctx, SpecRunnerInternal);
		return Context.make(SpecRunner, {
			spawn: internal.spawn,
			destroy: internal.destroy,
			dispatch: internal.dispatch,
		});
	}),
);
