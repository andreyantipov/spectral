import type { BuiltSpec, StateNode, Transition } from "@ctrl/arch.contract.spec";
import { Schema } from "effect";

// ---------------------------------------------------------------------------
// Ref types — returned by the transition callback's destructured helpers
// ---------------------------------------------------------------------------

type ActionRef = { readonly _kind: "action"; readonly name: string; readonly _tag: string };
type EffectRef = { readonly _kind: "effect"; readonly name: string };
type GuardRef = { readonly _kind: "guard"; readonly name: string };
type PipelineItem = EffectRef | GuardRef;

type StateRef = {
	readonly _kind: "state";
	readonly name: string;
	readonly _transitions: ReadonlyArray<{
		action: string;
		target: string;
		guards: string[];
		effects: string[];
	}>;
	on(action: ActionRef, target: StateRef, pipeline?: PipelineItem[]): StateRef;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const makeStateRef = (
	name: string,
	transitions: ReadonlyArray<{
		action: string;
		target: string;
		guards: string[];
		effects: string[];
	}> = [],
): StateRef => ({
	_kind: "state",
	name,
	_transitions: transitions,
	on(action: ActionRef, target: StateRef, pipeline: PipelineItem[] = []) {
		const guards: string[] = [];
		const effects: string[] = [];
		for (const item of pipeline) {
			if (item._kind === "guard") guards.push(item.name);
			else effects.push(item.name);
		}
		return makeStateRef(name, [
			...transitions,
			{ action: action.name, target: target.name, guards, effects },
		]);
	},
});

const makeActionRef = (name: string): ActionRef => ({
	_kind: "action",
	name,
	_tag: name,
});

const makeEffectRef = (name: string): EffectRef => ({
	_kind: "effect",
	name,
});

const makeGuardRef = (name: string): GuardRef => ({
	_kind: "guard",
	name,
});

// ---------------------------------------------------------------------------
// SpecConfig
// ---------------------------------------------------------------------------

type SpecConfig = {
	mode: "instance" | "singleton";
	domain: string;
	version: number;
};

// ---------------------------------------------------------------------------
// Internal accumulated data — immutable, passed through builder chain
// ---------------------------------------------------------------------------

type BuilderData = {
	readonly id: string;
	readonly config: SpecConfig;
	readonly actionDefs: Record<string, Record<string, Schema.Schema.All>>;
	readonly effectDefs: Record<string, Record<string, Schema.Schema.All>>;
	readonly guardDefs: Record<string, Schema.Schema.All>;
	readonly stateNames: readonly string[];
	readonly transitionFn:
		| ((refs: {
				action: Record<string, ActionRef>;
				effect: Record<string, EffectRef>;
				guard: Record<string, GuardRef>;
				state: Record<string, StateRef>;
		  }) => StateRef[])
		| undefined;
};

// ---------------------------------------------------------------------------
// Build helpers — extracted to reduce cognitive complexity
// ---------------------------------------------------------------------------

const buildActions = (
	actionDefs: Record<string, Record<string, Schema.Schema.All>>,
): Record<string, { readonly _tag: string; make: (props: unknown) => unknown }> => {
	const actions: Record<string, { readonly _tag: string; make: (props: unknown) => unknown }> = {};
	for (const [name, fields] of Object.entries(actionDefs)) {
		const schemaClass = Schema.TaggedClass<Record<string, unknown>>()(name, fields);
		actions[name] = {
			_tag: name,
			make: (props: unknown) => new (schemaClass as unknown as new (p: unknown) => unknown)(props),
		};
	}
	return actions;
};

const buildRefs = (
	actionDefs: Record<string, Record<string, Schema.Schema.All>>,
	effectDefs: Record<string, Record<string, Schema.Schema.All>>,
	guardDefs: Record<string, Schema.Schema.All>,
	stateNames: readonly string[],
) => {
	const actionRefs: Record<string, ActionRef> = {};
	for (const name of Object.keys(actionDefs)) actionRefs[name] = makeActionRef(name);

	const effectRefs: Record<string, EffectRef> = {};
	for (const name of Object.keys(effectDefs)) effectRefs[name] = makeEffectRef(name);

	const guardRefs: Record<string, GuardRef> = {};
	for (const name of Object.keys(guardDefs)) guardRefs[name] = makeGuardRef(name);

	const stateRefs: Record<string, StateRef> = {};
	for (const name of stateNames) stateRefs[name] = makeStateRef(name);

	return { actionRefs, effectRefs, guardRefs, stateRefs };
};

const buildStates = (
	transitionFn: BuilderData["transitionFn"],
	refs: ReturnType<typeof buildRefs>,
	stateNames: readonly string[],
) => {
	const stateResults = transitionFn
		? transitionFn({
				action: refs.actionRefs,
				effect: refs.effectRefs,
				guard: refs.guardRefs,
				state: refs.stateRefs,
			})
		: [];

	const states: Record<string, StateNode> = {};
	for (const name of stateNames) states[name] = {};

	const statesWithTransitions = new Set<string>();

	for (const stateRef of stateResults) {
		if (stateRef._transitions.length > 0) {
			statesWithTransitions.add(stateRef.name);
			const on: Record<string, Transition> = {};
			for (const t of stateRef._transitions) {
				const transition: Transition = {
					target: t.target,
					...(t.guards.length > 0 && { guards: t.guards }),
					...(t.effects.length > 0 && { effects: t.effects }),
				};
				on[t.action] = transition;
			}
			states[stateRef.name] = { on };
		}
	}

	return { states, stateResults, statesWithTransitions };
};

const collectTransitionKeys = (stateResults: readonly StateRef[]) => {
	const effects = new Set<string>();
	const guards = new Set<string>();
	const actions = new Set<string>();
	for (const stateRef of stateResults) {
		for (const t of stateRef._transitions) {
			actions.add(t.action);
			for (const e of t.effects) effects.add(e);
			for (const g of t.guards) guards.add(g);
		}
	}
	return { effects, guards, actions };
};

const extractKeys = (
	stateResults: readonly StateRef[],
	effectDefs: Record<string, Record<string, Schema.Schema.All>>,
	guardDefs: Record<string, Schema.Schema.All>,
	actionDefs: Record<string, Record<string, Schema.Schema.All>>,
) => {
	const fromTransitions = collectTransitionKeys(stateResults);

	for (const name of Object.keys(effectDefs)) fromTransitions.effects.add(name);
	for (const name of Object.keys(guardDefs)) fromTransitions.guards.add(name);
	for (const name of Object.keys(actionDefs)) fromTransitions.actions.add(name);

	return {
		allEffectKeys: [...fromTransitions.effects],
		allGuardKeys: [...fromTransitions.guards],
		allActionTags: [...fromTransitions.actions],
	};
};

const collectTerminalActions = (
	states: Record<string, StateNode>,
	terminalStateNames: Set<string>,
): string[] => {
	const result = new Set<string>();
	for (const stateNode of Object.values(states)) {
		if (stateNode.on === undefined) continue;
		for (const [actionTag, transition] of Object.entries(stateNode.on)) {
			if (terminalStateNames.has(transition.target)) result.add(actionTag);
		}
	}
	return [...result];
};

const detectTriggersAndTerminal = (
	config: SpecConfig,
	states: Record<string, StateNode>,
	stateNames: readonly string[],
	statesWithTransitions: Set<string>,
) => {
	if (config.mode !== "instance") return { triggers: [] as string[], terminalOn: [] as string[] };

	const terminalStateNames = new Set(stateNames.filter((name) => !statesWithTransitions.has(name)));
	const initial = stateNames[0];
	const initialNode = initial ? states[initial] : undefined;
	const triggers = initialNode?.on ? Object.keys(initialNode.on) : [];
	const terminalOn = collectTerminalActions(states, terminalStateNames);

	return { triggers, terminalOn };
};

const validateImplementation = (
	handlers: Record<string, (...args: never) => unknown>,
	effectKeys: string[],
	guardKeys: string[],
) => {
	const missing: string[] = [];
	for (const key of effectKeys) {
		if (!(key in handlers)) missing.push(key);
	}
	for (const key of guardKeys) {
		if (!(key in handlers)) missing.push(key);
	}
	if (missing.length > 0) {
		throw new Error(`implement(): missing handlers for: ${missing.join(", ")}`);
	}
};

// ---------------------------------------------------------------------------
// Builder — immutable fluent chain
// ---------------------------------------------------------------------------

const makeBuilder = (data: BuilderData) => ({
	actions<A extends Record<string, Record<string, Schema.Schema.All>>>(actionDefs: A) {
		return makeBuilder({
			...data,
			actionDefs: actionDefs as Record<string, Record<string, Schema.Schema.All>>,
		});
	},

	effects<E extends Record<string, Record<string, Schema.Schema.All>>>(effectDefs: E) {
		return makeBuilder({
			...data,
			effectDefs: effectDefs as Record<string, Record<string, Schema.Schema.All>>,
		});
	},

	guards<G extends Record<string, Schema.Schema.All>>(guardDefs: G) {
		return makeBuilder({ ...data, guardDefs: guardDefs as Record<string, Schema.Schema.All> });
	},

	states(...names: string[]) {
		return makeBuilder({ ...data, stateNames: names });
	},

	transitions(
		fn: (refs: {
			action: Record<string, ActionRef>;
			effect: Record<string, EffectRef>;
			guard: Record<string, GuardRef>;
			state: Record<string, StateRef>;
		}) => StateRef[],
	) {
		return makeBuilder({ ...data, transitionFn: fn });
	},

	build(): BuiltSpec {
		const { id, config, actionDefs, effectDefs, guardDefs, stateNames, transitionFn } = data;

		const actions = buildActions(actionDefs);
		const refs = buildRefs(actionDefs, effectDefs, guardDefs, stateNames);
		const { states, stateResults, statesWithTransitions } = buildStates(
			transitionFn,
			refs,
			stateNames,
		);

		// --- Validate ---
		const initial = stateNames[0];
		if (initial === undefined) {
			throw new Error("Spec: at least one state required");
		}

		for (const [stateName, stateNode] of Object.entries(states)) {
			if (stateNode.on === undefined) continue;
			for (const [eventTag, transition] of Object.entries(stateNode.on)) {
				if (!(transition.target in states)) {
					throw new Error(
						`Spec: transition target "${transition.target}" in state "${stateName}" on "${eventTag}" does not exist in [${Object.keys(states).join(", ")}]`,
					);
				}
			}
		}

		const { allEffectKeys, allGuardKeys, allActionTags } = extractKeys(
			stateResults,
			effectDefs,
			guardDefs,
			actionDefs,
		);
		const { triggers, terminalOn } = detectTriggersAndTerminal(
			config,
			states,
			stateNames,
			statesWithTransitions,
		);

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
			emitKeys: [],
			guardKeys: allGuardKeys,
			actionTags: allActionTags,
			actions,
			implement: (handlers: Record<string, (...args: never) => unknown>) => {
				validateImplementation(handlers, allEffectKeys, allGuardKeys);
				return handlers;
			},
		};
	},
});

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
	});
