import { EventBus } from "@ctrl/arch.contract.event-bus";
import type { Spec } from "@ctrl/arch.contract.spec";
import { SpecRegistry } from "@ctrl/arch.contract.spec-registry";
import { SpecRunnerInternal } from "@ctrl/arch.contract.spec-runner";
import { Effect, Layer, Ref, Stream } from "effect";

export const SpecRegistryLive = Layer.scoped(
	SpecRegistry,
	Effect.gen(function* () {
		const runner = yield* SpecRunnerInternal;
		const bus = yield* EventBus;
		const specs = yield* Ref.make<Spec[]>([]);

		// Routing maps: action tag -> spec entry that handles it
		const triggerMap = yield* Ref.make(new Map<string, Spec>());
		const terminalMap = yield* Ref.make(new Map<string, Spec>());

		const register = (spec: Spec): Effect.Effect<void> =>
			Effect.gen(function* () {
				yield* Ref.update(specs, (s) => [...s, spec]);

				// Register spec definition with SpecRunner
				yield* runner.registerSpec(spec);

				// Update trigger map
				yield* Ref.update(triggerMap, (m) => {
					const next = new Map(m);
					for (const t of spec.triggers) next.set(t, spec);
					return next;
				});

				// Update terminal map
				yield* Ref.update(terminalMap, (m) => {
					const next = new Map(m);
					for (const t of spec.terminalOn) next.set(t, spec);
					return next;
				});

				// Auto-spawn singletons immediately
				if (spec.mode === "singleton") {
					yield* runner.spawn(spec.id, spec.id);
				}
			});

		const describe = (): Effect.Effect<readonly Spec[]> => Ref.get(specs);

		yield* Effect.logInfo("[SpecRegistry] started");
		const registeredSpecs = yield* Ref.get(specs);
		yield* Effect.logInfo(`[SpecRegistry] specs registered: ${registeredSpecs.length}`);

		// Subscribe to EventBus commands and route to SpecRunner instances
		yield* bus.commands.pipe(
			Stream.runForEach((cmd) =>
				Effect.gen(function* () {
					const actionTag = cmd.action;
					const payload = (cmd.payload ?? {}) as Record<string, unknown>;
					const action = { _tag: actionTag, ...payload };
					yield* Effect.logDebug(`[SpecRegistry] cmd: ${actionTag}`);

					// 1. Trigger match: spawn new instance
					const triggers = yield* Ref.get(triggerMap);
					const triggerSpec = triggers.get(actionTag);
					if (triggerSpec) {
						const instanceId =
							triggerSpec.mode === "singleton" ? triggerSpec.id : crypto.randomUUID();
						// Only spawn non-singletons (singletons auto-spawn at register time)
						if (triggerSpec.mode !== "singleton") {
							yield* runner.spawn(triggerSpec.id, instanceId);
						}
						// Inject instanceId into action so features know which instance they serve
						yield* runner.dispatch(instanceId, { ...action, instanceId });
						return;
					}

					// 2. TerminalOn match: dispatch then destroy
					const terminals = yield* Ref.get(terminalMap);
					const terminalSpec = terminals.get(actionTag);
					if (terminalSpec && payload.instanceId) {
						const instanceId = payload.instanceId as string;
						yield* runner.dispatch(instanceId, action);
						// Allow the transition to process before destroying
						yield* Effect.sleep("10 millis");
						yield* runner.destroy(terminalSpec.id, instanceId);
						return;
					}

					// 3. Normal dispatch by instanceId
					if (payload.instanceId) {
						yield* runner.dispatch(payload.instanceId as string, action);
						return;
					}

					yield* Effect.logDebug(
						`[SpecRegistry] unrouted: ${actionTag} (no trigger, no terminal, no instanceId)`,
					);
				}),
			),
			Effect.forkScoped,
		);

		return { register, describe };
	}),
);
