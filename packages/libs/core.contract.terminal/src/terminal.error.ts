import { Schema } from "effect";

export class TerminalError extends Schema.TaggedError<TerminalError>()("TerminalError", {
	reason: Schema.Union(
		Schema.Literal("spawn-failed"),
		Schema.Literal("not-found"),
		Schema.Literal("already-closed"),
	),
	terminalId: Schema.optional(Schema.String),
	message: Schema.String,
}) {}
