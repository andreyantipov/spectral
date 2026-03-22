import type { Schema } from "effect";

/** Typed command definition */
export type CommandDef<N extends string = string, P = void> = {
	readonly _tag: "command";
	readonly name: N;
	readonly schema: Schema.Schema<P>;
};

/** Typed event definition */
export type EventDef<N extends string = string, P = void> = {
	readonly _tag: "event";
	readonly name: N;
	readonly schema: Schema.Schema<P>;
};

/** Create a typed command definition */
export const command = <N extends string, P>(
	name: N,
	schema: Schema.Schema<P>,
): CommandDef<N, P> => ({
	_tag: "command",
	name,
	schema,
});

/** Create a typed event definition */
export const event = <N extends string, P>(name: N, schema: Schema.Schema<P>): EventDef<N, P> => ({
	_tag: "event",
	name,
	schema,
});
