import { DatabaseError } from "@ctrl/core.base.errors";
import { Bookmark } from "@ctrl/core.base.model";
import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

export const BookmarkEvents = EventGroup.empty
	.add({
		tag: "bm.add",
		primaryKey: (p) => p.url,
		payload: Schema.Struct({ url: Schema.String, title: Schema.NullOr(Schema.String) }),
		success: Bookmark,
	})
	.add({
		tag: "bm.remove",
		primaryKey: (p) => p.id,
		payload: Schema.Struct({ id: Schema.String }),
		success: Schema.Void,
	})
	.addError(DatabaseError);
