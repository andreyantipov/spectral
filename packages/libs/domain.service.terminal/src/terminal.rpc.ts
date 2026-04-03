import { Schema } from "effect";

/**
 * High-frequency terminal I/O schemas.
 *
 * These are defined as plain Schema structs (not @effect/rpc) because
 * cross-process delivery uses EventBus over IPC Bridge, not RPC.
 * The actual streaming wiring will happen in the wire package.
 */

export const TerminalWritePayload = Schema.Struct({
	id: Schema.String,
	data: Schema.String,
});

export const TerminalOutputPayload = Schema.Struct({
	id: Schema.String,
});

export type TerminalWritePayload = typeof TerminalWritePayload.Type;
export type TerminalOutputPayload = typeof TerminalOutputPayload.Type;
