import { Schema } from "effect";

export const TerminalInfoSchema = Schema.Struct({
	id: Schema.String,
	shell: Schema.String,
	cwd: Schema.String,
	cols: Schema.Number,
	rows: Schema.Number,
	createdAt: Schema.Number,
});

export type TerminalInfo = typeof TerminalInfoSchema.Type;
