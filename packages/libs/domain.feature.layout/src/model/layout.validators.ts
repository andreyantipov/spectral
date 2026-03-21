import { Schema } from "effect";

export const PanelRefSchema = Schema.Struct({
	id: Schema.String,
	type: Schema.Literal("session", "tool"),
	sessionId: Schema.optional(Schema.String),
	toolId: Schema.optional(Schema.String),
});

export type PanelRef = typeof PanelRefSchema.Type;

export const GroupNodeSchema = Schema.Struct({
	type: Schema.Literal("group"),
	panels: Schema.Array(PanelRefSchema),
	activePanel: Schema.String,
});

export type GroupNode = typeof GroupNodeSchema.Type;

// Manual type annotations required for recursive schema references
export type SplitNode = {
	readonly type: "split";
	readonly direction: "horizontal" | "vertical";
	readonly children: readonly LayoutNode[];
	readonly sizes: readonly number[];
};

export type LayoutNode = SplitNode | GroupNode;

export const LayoutNodeSchema: Schema.Schema<LayoutNode> = Schema.suspend(() =>
	Schema.Union(SplitNodeSchema, GroupNodeSchema),
);

export const SplitNodeSchema: Schema.Schema<SplitNode> = Schema.suspend(() =>
	Schema.Struct({
		type: Schema.Literal("split"),
		direction: Schema.Literal("horizontal", "vertical"),
		children: Schema.Array(LayoutNodeSchema),
		sizes: Schema.Array(Schema.Number),
	}),
);

export const PersistedLayoutSchema = Schema.Struct({
	version: Schema.Number,
	dockviewState: Schema.Unknown,
});

export type PersistedLayout = typeof PersistedLayoutSchema.Type;
