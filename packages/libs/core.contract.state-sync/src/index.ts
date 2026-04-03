import { Context, type Effect } from "effect";

export class StateSync extends Context.Tag("StateSync")<
	StateSync,
	{
		/** Register a state path with its snapshot function. Called once at service startup. */
		readonly register: (
			path: string,
			snapshot: () => Effect.Effect<unknown>,
		) => Effect.Effect<void>;
		/** Get current full state as JSON. Used by MCP and IPC. */
		readonly getSnapshot: () => Effect.Effect<Record<string, unknown>>;
	}
>() {}
