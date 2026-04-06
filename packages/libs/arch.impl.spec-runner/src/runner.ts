import { EventBus } from "@ctrl/arch.contract.event-bus";
import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry";
import type { Spec } from "@ctrl/arch.contract.spec";
import { type Action, SpecRunner, SpecRunnerInternal } from "@ctrl/arch.contract.spec-runner";
import { Context, Effect, FiberMap, Layer, Queue, Ref } from "effect";

/** Run guard functions; return false if any guard rejects. */
const checkGuards = (
	guards: readonly string[] | undefined,
	action: Record<string, unknown>,
	registry: FeatureRegistry["Type"],
) =>
	Effect.gen(function* () {
		if (!guards) return true;
		for (const guard of guards) {
			const result = yield* registry.execute(guard, action).pipe(
				Effect.catchAll((err) => {
					return Effect.logWarning(`guard "${guard}" threw: ${err}`).pipe(Effect.as(false));
				}),
			);
			if (!result) return false;
		}
		return true;
	});

type AccResult = {
	data: Record<string, unknown>;
	emit: Record<string, unknown>;
};

/** Merge an EffectResult into the accumulator (pure — returns new AccResult). */
const mergeResult = (acc: AccResult, result: unknown): AccResult => {
	if (!result || typeof result !== "object") return acc;
	const er = result as Record<string, unknown>;
	const newData =
		er.data && typeof er.data === "object"
			? { ...acc.data, ...(er.data as Record<string, unknown>) }
			: acc.data;
	const newEmit =
		er.emit && typeof er.emit === "object"
			? { ...acc.emit, ...(er.emit as Record<string, unknown>) }
			: acc.emit;
	return { data: newData, emit: newEmit };
};

/** Run effects sequentially, accumulating data and emit from EffectResult. */
const runEffects = (
	effects: readonly string[] | undefined,
	action: Record<string, unknown>,
	instanceId: string,
	registry: FeatureRegistry["Type"],
) =>
	Effect.gen(function* () {
		let acc: AccResult = { data: {}, emit: {} };
		if (!effects) return acc;

		for (const effectName of effects) {
			const payload = { ...action, ...acc.data, instanceId } as Record<string, unknown>;
			const result = yield* registry.execute(effectName, payload);
			acc = mergeResult(acc, result);
		}
		return acc;
	});

/** Dispatch collected emits as EventBus commands. */
const dispatchEmits = (emits: Record<string, unknown>, bus: EventBus["Type"]) =>
	Effect.gen(function* () {
		for (const [emitAction, emitPayload] of Object.entries(emits)) {
			yield* bus
				.send({
					type: "command",
					action: emitAction,
					payload: emitPayload as Record<string, unknown>,
					meta: { source: "spec" },
				})
				.pipe(
					Effect.catchAll((err) =>
						Effect.logWarning(`emit dispatch failed: ${emitAction}: ${err}`),
					),
				);
		}
	});

/** Publish a spec.transition event to the EventBus. */
const publishTransition = (
	spec: Spec,
	instanceId: string,
	from: string,
	to: string,
	actionTag: string,
	bus: EventBus["Type"],
) =>
	bus
		.publish({
			type: "event",
			name: "spec.transition",
			payload: { specId: spec.id, instanceId, from, to, action: actionTag, timestamp: Date.now() },
			timestamp: Date.now(),
		})
		.pipe(Effect.catchAll(() => Effect.void));

const runInstance = (
	spec: Spec,
	instanceId: string,
	queue: Queue.Queue<Action>,
	initialState: string,
	registry: FeatureRegistry["Type"],
	bus: EventBus["Type"],
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

				const allowed = yield* checkGuards(
					transition.guards,
					action as Record<string, unknown>,
					registry,
				);
				if (!allowed) return;

				const prevState = current;
				yield* Ref.set(stateRef, transition.target);

				const acc = yield* runEffects(
					transition.effects,
					action as Record<string, unknown>,
					instanceId,
					registry,
				).pipe(
					Effect.catchAllCause((cause) => {
						return Effect.logError(
							`[SpecRunner] effect failed in ${spec.id}/${instanceId}: ${action._tag} (${prevState}→${transition.target}): ${cause}`,
						).pipe(Effect.as({ data: {}, emit: {} }));
					}),
				);
				yield* dispatchEmits(acc.emit, bus);
				yield* publishTransition(spec, instanceId, prevState, transition.target, action._tag, bus);
			}),
		);
	});

export const SpecRunnerLive = Layer.scoped(
	SpecRunnerInternal,
	Effect.gen(function* () {
		const registry = yield* FeatureRegistry;
		const bus = yield* EventBus;
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

				yield* runInstance(spec, instanceId, queue, initial, registry, bus).pipe(
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
