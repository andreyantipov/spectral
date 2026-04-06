import { DatabaseError, ValidationError } from "@ctrl/base.error";
import { Session } from "@ctrl/base.schema";
import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

export const NavigationEvents = EventGroup.empty
	.add({
		tag: "nav.navigate",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String, input: Schema.String }),
		success: Session,
	})
	.add({
		tag: "nav.back",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String }),
		success: Session,
	})
	.add({
		tag: "nav.forward",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String }),
		success: Session,
	})
	.add({
		tag: "nav.report",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String, url: Schema.String }),
		success: Schema.Void,
	})
	.add({
		tag: "nav.update-title",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String, title: Schema.String }),
		success: Schema.Void,
	})
	.addError(DatabaseError)
	.addError(ValidationError);
