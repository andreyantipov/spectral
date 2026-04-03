import { Schema } from "effect";

export const PanelRefSchema = Schema.Struct({
	id: Schema.String,
	type: Schema.Literal("session", "tool"),
	entityId: Schema.String,
	title: Schema.optionalWith(Schema.String, { default: () => "New Tab" }),
	icon: Schema.NullOr(Schema.String),
});

export type PanelRef = typeof PanelRefSchema.Type;
