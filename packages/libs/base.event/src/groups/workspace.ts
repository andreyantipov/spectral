import { DatabaseError } from "@ctrl/base.error";
import { PanelRefSchema, PersistedLayoutSchema } from "@ctrl/base.schema";
import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

export const WorkspaceEvents = EventGroup.empty
	.add({
		tag: "ws.update-layout",
		primaryKey: () => "global",
		payload: Schema.Struct({
			layout: PersistedLayoutSchema,
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
	.add({
		tag: "ws.resize",
		primaryKey: (p) => p.splitId,
		payload: Schema.Struct({
			splitId: Schema.String,
			sizes: Schema.Array(Schema.Number),
		}),
		success: Schema.Void,
	})
	.add({
		tag: "ws.activate-panel",
		primaryKey: (p) => p.panelId,
		payload: Schema.Struct({ panelId: Schema.String }),
		success: Schema.Void,
	})
	.add({
		tag: "ws.reorder-panel",
		primaryKey: (p) => p.panelId,
		payload: Schema.Struct({
			groupId: Schema.String,
			panelId: Schema.String,
			index: Schema.Number,
		}),
		success: Schema.Void,
	})
	.add({
		tag: "ws.add-panel",
		primaryKey: (p) => p.groupId,
		payload: Schema.Struct({
			groupId: Schema.String,
			panel: PanelRefSchema,
		}),
		success: Schema.Void,
	})
	.add({
		tag: "ws.update-tab-meta",
		primaryKey: (p) => p.panelId,
		payload: Schema.Struct({
			panelId: Schema.String,
			title: Schema.optional(Schema.String),
			icon: Schema.optional(Schema.NullOr(Schema.String)),
		}),
		success: Schema.Void,
	})
	.addError(DatabaseError);
