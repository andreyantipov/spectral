import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

export const UIEvents = EventGroup.empty
	.add({
		tag: "ui.toggle-omnibox",
		primaryKey: () => "global",
		payload: Schema.Struct({}),
		success: Schema.Void,
	})
	.add({
		tag: "ui.toggle-sidebar",
		primaryKey: () => "global",
		payload: Schema.Struct({}),
		success: Schema.Void,
	});
