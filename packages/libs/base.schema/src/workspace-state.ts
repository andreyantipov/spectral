import { Schema } from "effect";
import { LayoutNodeSchema } from "./layout-node";

export const WorkspaceStateSchema = Schema.Struct({
	root: LayoutNodeSchema,
});
export type WorkspaceState = typeof WorkspaceStateSchema.Type;
