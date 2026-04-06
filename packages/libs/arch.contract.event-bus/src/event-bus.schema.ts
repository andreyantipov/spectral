import { type ShortcutBinding, ShortcutBindingSchema } from "@ctrl/base.schema";
import { Schema } from "effect";

export const AppCommandSchema = Schema.Struct({
	type: Schema.Literal("command"),
	action: Schema.String,
	payload: Schema.optional(Schema.Unknown),
	meta: Schema.optional(
		Schema.Struct({
			source: Schema.Literal("keyboard", "menu", "agent", "ui", "system", "spec"),
		}),
	),
});

export const AppEventSchema = Schema.Struct({
	type: Schema.Literal("event"),
	name: Schema.String,
	payload: Schema.optional(Schema.Unknown),
	timestamp: Schema.Number,
	causedBy: Schema.optional(Schema.String),
});

export type { ShortcutBinding };
export { ShortcutBindingSchema };
