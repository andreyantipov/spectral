import { Bookmark, HistoryEntry, Session } from "@ctrl/core.base.model";
import { Schema } from "effect";

export const BrowsingStateSchema = Schema.Struct({
	sessions: Schema.Array(Session),
	bookmarks: Schema.Array(Bookmark),
	history: Schema.Array(HistoryEntry),
});
export type BrowsingState = typeof BrowsingStateSchema.Type;
