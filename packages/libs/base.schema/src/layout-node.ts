import { Schema } from "effect";
import { PanelRefSchema } from "./panel-ref";

export const GroupNodeSchema = Schema.Struct({
	id: Schema.String,
	type: Schema.Literal("group"),
	panels: Schema.Array(PanelRefSchema),
	activePanel: Schema.String,
});

export type GroupNode = typeof GroupNodeSchema.Type;

// Manual type annotations required for recursive schema references
export type SplitNode = {
	readonly id: string;
	readonly type: "split";
	readonly direction: "horizontal" | "vertical";
	readonly children: readonly LayoutNode[];
	readonly sizes: readonly number[];
};

export type LayoutNode = SplitNode | GroupNode;

export const LayoutNodeSchema: Schema.Schema<LayoutNode> = Schema.suspend(() =>
	Schema.Union(SplitNodeSchema, GroupNodeSchema),
) as Schema.Schema<LayoutNode>;

export const SplitNodeSchema: Schema.Schema<SplitNode> = Schema.suspend(() =>
	Schema.Struct({
		id: Schema.String,
		type: Schema.Literal("split"),
		direction: Schema.Literal("horizontal", "vertical"),
		children: Schema.Array(LayoutNodeSchema),
		sizes: Schema.Array(Schema.Number),
	}),
);

export const PersistedLayoutSchema = Schema.Struct({
	version: Schema.Literal(2),
	root: LayoutNodeSchema,
});

export type PersistedLayout = typeof PersistedLayoutSchema.Type;
