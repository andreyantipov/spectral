import { Schema } from "effect";

export type ShortcutBinding = {
	readonly action: string;
	readonly shortcut: string;
	readonly label: string;
	readonly when?: string;
	readonly payload?: Record<string, unknown>;
};

export const ShortcutBindingSchema = Schema.Struct({
	action: Schema.String,
	shortcut: Schema.String,
	label: Schema.String,
	when: Schema.optional(Schema.String),
	payload: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
