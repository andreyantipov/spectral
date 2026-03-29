import { DatabaseError } from "@ctrl/base.error";
import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

export const SystemEvents = EventGroup.empty
	.add({
		tag: "state.request",
		primaryKey: () => "global",
		payload: Schema.Struct({}),
		success: Schema.Void,
	})
	.add({
		tag: "state.snapshot",
		primaryKey: () => "global",
		payload: Schema.Unknown,
		success: Schema.Void,
	})
	.add({
		tag: "diag.ping",
		primaryKey: () => "global",
		payload: Schema.Struct({}),
		success: Schema.Void,
	})
	.add({
		tag: "diag.pong",
		primaryKey: () => "global",
		payload: Schema.Struct({ message: Schema.String }),
		success: Schema.Void,
	})
	.addError(DatabaseError);
