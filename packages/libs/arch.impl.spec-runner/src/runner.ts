import { EventBus } from "@ctrl/arch.contract.event-bus";
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

/** Run guard functions; return false if any guard rejects. */
const checkGuards = (
	guards: readonly string[] | undefined,
	action: Record<string, unknown>,
	registry: FeatureRegistry["Type"],
) =>
	Effect.gen(function* () {
		if (!guards) return true;
		for (const guard of guards) {
			const result = yield* registry.execute(guard, action);
			if (!result) return false;
		}
		return true;
	});

type AccResult = {
	data: Record<string, unknown>;
	emit: Record<string, unknown>;
};

/** Merge an EffectResult into the accumulator (mutates acc). */
const mergeResult = (acc: AccResult, result: unknown): void => {
	if (!result || typeof result !== "object") return;
	const er = result as { data?: Record<string, unknown>; emit?: Record<string, unknown> };
	if (er.data) acc.data = { ...acc.data, ...er.data };
	if (er.emit) acc.emit = { ...acc.emit, ...er.emit };
};

/** Run effects sequentially, accumulating data and emit from EffectResult. */
const runEffects = (
	effects: readonly string[] | undefined,
	action: Record<string, unknown>,
	instanceId: string,
	registry: FeatureRegistry["Type"],
) =>
	Effect.gen(function* () {
		const acc: AccResult = { data: {}, emit: {} };
		if (!effects) return acc;

		for (const effectName of effects) {
			const payload = { ...action, ...acc.data, instanceId } as Record<string, unknown>;
			const result = yield* registry.execute(effectName, payload);
			mergeResult(acc, result);
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
				.pipe(Effect.catchAll(() => Effect.void));
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
