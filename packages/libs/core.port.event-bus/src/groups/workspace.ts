import { DatabaseError } from "@ctrl/core.base.errors";
import { PanelRefSchema } from "@ctrl/core.base.model";
import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

export const WorkspaceEvents = EventGroup.empty
	.add({
		tag: "ws.get-layout",
		primaryKey: () => "global",
		payload: Schema.Struct({}),
		success: Schema.Unknown,
	})
	.add({
		tag: "ws.update-layout",
		primaryKey: () => "global",
		payload: Schema.Struct({
			layout: Schema.Struct({
				version: Schema.Number,
				dockviewState: Schema.Unknown,
			}),
		}),
		success: Schema.Void,
	})
	.add({
		tag: "ws.split-panel",
		primaryKey: (p) => p.panelId,
		payload: Schema.Struct({
			panelId: Schema.String,
			direction: Schema.Literal("horizontal", "vertical"),
			newPanel: PanelRefSchema,
		}),
		success: Schema.Void,
	})
	.add({
		tag: "ws.move-panel",
		primaryKey: (p) => p.panelId,
		payload: Schema.Struct({
			panelId: Schema.String,
			targetGroupId: Schema.String,
		}),
		success: Schema.Void,
	})
	.add({
		tag: "ws.close-panel",
		primaryKey: (p) => p.panelId,
		payload: Schema.Struct({ panelId: Schema.String }),
		success: Schema.Void,
	})
	.addError(DatabaseError);
