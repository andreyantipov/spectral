import { DatabaseError } from "@ctrl/core.base.errors";
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

/** @deprecated Use SystemEvents.events["state.snapshot"].tag instead */
export const STATE_SNAPSHOT = SystemEvents.events["state.snapshot"].tag;
/** @deprecated Use SystemEvents.events["state.request"].tag instead */
export const STATE_REQUEST = SystemEvents.events["state.request"].tag;
/** @deprecated Use SystemEvents.events["diag.ping"].tag instead */
export const DIAG_PING = SystemEvents.events["diag.ping"].tag;
/** @deprecated Use SystemEvents.events["diag.pong"].tag instead */
export const DIAG_PONG = SystemEvents.events["diag.pong"].tag;
