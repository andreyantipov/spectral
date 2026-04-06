import { DatabaseError } from "@ctrl/base.error";
import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

export const SystemEvents = EventGroup.empty
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
	.add({
		tag: "diag.screenshot",
		primaryKey: () => "global",
		payload: Schema.Struct({}),
		success: Schema.Void,
	})
	.add({
		tag: "diag.eval-js",
		primaryKey: () => "global",
		payload: Schema.Struct({ code: Schema.String }),
		success: Schema.Void,
	})
	.add({
		tag: "diag.eval-js-result",
		primaryKey: () => "global",
		payload: Schema.Struct({
			result: Schema.String,
			error: Schema.optional(Schema.String),
		}),
		success: Schema.Void,
	})
	.add({
		tag: "diag.screenshot-result",
		primaryKey: () => "global",
		payload: Schema.Struct({
			data: Schema.String,
			width: Schema.Number,
			height: Schema.Number,
			timestamp: Schema.Number,
		}),
		success: Schema.Void,
	})
	.addError(DatabaseError);
