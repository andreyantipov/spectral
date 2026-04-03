import { Schema } from "effect";
import { Bookmark } from "./bookmark";
import { HistoryEntry } from "./history-entry";
import { PersistedLayoutSchema } from "./layout-node";
import { Session } from "./session";

export const BrowsingStateSchema = Schema.Struct({
	sessions: Schema.Array(Session),
	bookmarks: Schema.Array(Bookmark),
	history: Schema.Array(HistoryEntry),
	layout: Schema.optional(PersistedLayoutSchema),
});
export type BrowsingState = typeof BrowsingStateSchema.Type;
