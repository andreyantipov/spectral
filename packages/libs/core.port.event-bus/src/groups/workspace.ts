import { DatabaseError } from "@ctrl/core.base.errors";
import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

const PanelRefPayload = Schema.Struct({
	id: Schema.String,
	type: Schema.Literal("session", "tool"),
	sessionId: Schema.optional(Schema.String),
	toolId: Schema.optional(Schema.String),
});

export const WorkspaceEvents = EventGroup.empty
	.add({
		tag: "ws.split-panel",
		primaryKey: (p) => p.panelId,
		payload: Schema.Struct({
			panelId: Schema.String,
			direction: Schema.Literal("horizontal", "vertical"),
			newPanel: PanelRefPayload,
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
