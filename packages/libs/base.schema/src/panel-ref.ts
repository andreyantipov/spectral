import { Schema } from "effect";

export const PanelRefSchema = Schema.Struct({
	id: Schema.String,
	type: Schema.Literal("session", "tool"),
	sessionId: Schema.optional(Schema.String),
	toolId: Schema.optional(Schema.String),
});

export type PanelRef = typeof PanelRefSchema.Type;
