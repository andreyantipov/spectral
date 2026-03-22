import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";

const AppCommandSchema = Schema.Struct({
	type: Schema.Literal("command"),
	action: Schema.String,
	payload: Schema.optional(Schema.Unknown),
	meta: Schema.optional(
		Schema.Struct({
			source: Schema.Literal("keyboard", "menu", "agent", "ui", "system"),
		}),
	),
});

const AppEventSchema = Schema.Struct({
	type: Schema.Literal("event"),
	name: Schema.String,
	payload: Schema.optional(Schema.Unknown),
	timestamp: Schema.Number,
	causedBy: Schema.optional(Schema.String),
});

export class EventBusRpcs extends RpcGroup.make(
	Rpc.make("dispatch", {
		payload: { command: AppCommandSchema },
		success: Schema.Void,
	}),
	Rpc.make("eventStream", {
		success: AppEventSchema,
		stream: true,
	}),
) {}
