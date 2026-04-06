import { DatabaseError } from "@ctrl/base.error";
import { Session } from "@ctrl/base.schema";
import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

export const SessionEvents = EventGroup.empty
	.add({
		tag: "session.create",
		primaryKey: () => "global",
		payload: Schema.Struct({ mode: Schema.Literal("visual") }),
		success: Session,
	})
	.add({
		tag: "session.close",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String }),
		success: Schema.Void,
	})
	.add({
		tag: "session.activate",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String }),
		success: Schema.Void,
	})
	.addError(DatabaseError);
