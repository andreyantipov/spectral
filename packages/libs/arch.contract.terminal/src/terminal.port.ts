import type { TerminalError } from "./terminal.error";
import { Context, type Effect, type Stream } from "effect";

export const TERMINAL_PORT_ID = "TerminalPort" as const;

export class TerminalPort extends Context.Tag(TERMINAL_PORT_ID)<
	TerminalPort,
	{
		readonly spawn: (opts: {
			shell?: string;
			cwd?: string;
		}) => Effect.Effect<{ id: string }, TerminalError>;
		readonly write: (id: string, data: string) => Effect.Effect<void, TerminalError>;
		readonly resize: (id: string, cols: number, rows: number) => Effect.Effect<void, TerminalError>;
		readonly close: (id: string) => Effect.Effect<void, TerminalError>;
		readonly output: (id: string) => Stream.Stream<Uint8Array, TerminalError>;
	}
>() {}
