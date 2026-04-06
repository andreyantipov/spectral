// ---------------------------------------------------------------------------
// Spec — JSON-serializable contract (used by runner/registry). No runtime fns.
// ---------------------------------------------------------------------------

export type Transition = {
	readonly target: string;
	readonly guards?: readonly string[];
	readonly effects?: readonly string[];
};

export type StateNode = {
	readonly on?: Record<string, Transition>;
};

export type Spec = {
	readonly id: string;
	readonly version: number;
	readonly domain: string;
	readonly mode: "instance" | "singleton";
	readonly initial: string;
	readonly triggers: readonly string[];
	readonly terminalOn: readonly string[];
	readonly states: Record<string, StateNode>;
	readonly onStart?: readonly string[];
	readonly onStop?: readonly string[];
	readonly effectKeys: ReadonlySet<string>;
	readonly emitKeys: ReadonlySet<string>;
	readonly guardKeys: ReadonlySet<string>;
	readonly actionTags: ReadonlySet<string>;
};

// ---------------------------------------------------------------------------
// BuiltSpec — extends Spec with runtime capabilities (returned by builder).
// ---------------------------------------------------------------------------

export type BuiltSpec = Spec & {
	readonly actions: Record<string, { readonly _tag: string; make: (props: unknown) => unknown }>;
	readonly implement: (
		handlers: Record<string, (...args: never) => unknown>,
	) => Record<string, (...args: never) => unknown>;
};
