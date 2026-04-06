import { Schema } from "effect"

export class CreateSession extends Schema.TaggedClass<CreateSession>()("CreateSession", {
	mode: Schema.Literal("visual"),
}) {}

export class CloseSession extends Schema.TaggedClass<CloseSession>()("CloseSession", {
	instanceId: Schema.String,
}) {}

export class ActivateSession extends Schema.TaggedClass<ActivateSession>()("ActivateSession", {
	instanceId: Schema.String,
}) {}
