import { DatabaseError } from "@ctrl/core.base.errors";
import {
	LayoutNodeSchema,
	PanelRefSchema,
	PersistedLayoutSchema,
} from "@ctrl/domain.feature.layout";
import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";

export class WorkspaceRpcs extends RpcGroup.make(
	Rpc.make("getLayout", {
		success: LayoutNodeSchema,
		error: DatabaseError,
	}),
	Rpc.make("updateLayout", {
		payload: { layout: PersistedLayoutSchema },
		success: Schema.Void,
		error: DatabaseError,
	}),
	Rpc.make("splitPanel", {
		payload: {
			panelId: Schema.String,
			direction: Schema.Literal("horizontal", "vertical"),
			newPanel: PanelRefSchema,
		},
		success: Schema.Void,
		error: DatabaseError,
	}),
	Rpc.make("movePanel", {
		payload: { panelId: Schema.String, targetGroupId: Schema.String },
		success: Schema.Void,
		error: DatabaseError,
	}),
	Rpc.make("closePanel", {
		payload: { panelId: Schema.String },
		success: Schema.Void,
		error: DatabaseError,
	}),
	Rpc.make("workspaceChanges", {
		success: PersistedLayoutSchema,
		stream: true,
	}),
) {}
