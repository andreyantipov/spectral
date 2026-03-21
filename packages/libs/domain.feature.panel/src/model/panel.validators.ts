import { Schema } from "effect";

export const PanelDescriptorSchema = Schema.Struct({
	type: Schema.Literal("session", "tool"),
	toolId: Schema.optional(Schema.String),
	label: Schema.String,
	icon: Schema.String,
});

export type PanelDescriptor = typeof PanelDescriptorSchema.Type;

export const STATIC_PANEL_TYPES: readonly PanelDescriptor[] = [
	{ type: "session", label: "Web Page", icon: "globe" },
	{ type: "tool", toolId: "bookmarks", label: "Bookmarks", icon: "bookmark" },
	{ type: "tool", toolId: "history", label: "History", icon: "history" },
];
