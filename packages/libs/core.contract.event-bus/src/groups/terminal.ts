import { TerminalError } from "@ctrl/base.error";
import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

export const TerminalEvents = EventGroup.empty
	.add({
		tag: "term.create",
		primaryKey: () => "global",
		payload: Schema.Struct({
			shell: Schema.optional(Schema.String),
			cwd: Schema.optional(Schema.String),
		}),
		success: Schema.Struct({ id: Schema.String }),
	})
	.add({
		tag: "term.resize",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({
			id: Schema.String,
			cols: Schema.Number,
			rows: Schema.Number,
		}),
		success: Schema.Void,
	})
	.add({
		tag: "term.close",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String }),
		success: Schema.Void,
	})
	.addError(TerminalError);
