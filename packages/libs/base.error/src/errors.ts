import { Schema } from "effect";

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
	message: Schema.String,
	cause: Schema.optional(Schema.Unknown),
}) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
	message: Schema.String,
	field: Schema.optional(Schema.String),
}) {}

export class TerminalError extends Schema.TaggedError<TerminalError>()("TerminalError", {
	reason: Schema.Union(
		Schema.Literal("spawn-failed"),
		Schema.Literal("not-found"),
		Schema.Literal("already-closed"),
	),
	terminalId: Schema.optional(Schema.String),
	message: Schema.String,
}) {}
