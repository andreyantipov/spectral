import {
	BookmarkSchema,
	BrowsingStateSchema,
	DatabaseError,
	HistoryEntrySchema,
	SessionSchema,
	ValidationError,
} from "@ctrl/core.shared";
import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";

export class BrowsingRpcs extends RpcGroup.make(
	// Session RPCs
	Rpc.make("createSession", {
		payload: { mode: Schema.Literal("visual") },
		success: SessionSchema,
		error: DatabaseError,
	}),
	Rpc.make("removeSession", {
		payload: { id: Schema.String },
		success: Schema.Void,
		error: DatabaseError,
	}),
	Rpc.make("navigate", {
		payload: { id: Schema.String, input: Schema.String },
		success: SessionSchema,
		error: Schema.Union(DatabaseError, ValidationError),
	}),
	Rpc.make("goBack", {
		payload: { id: Schema.String },
		success: SessionSchema,
		error: Schema.Union(DatabaseError, ValidationError),
	}),
	Rpc.make("goForward", {
		payload: { id: Schema.String },
		success: SessionSchema,
		error: Schema.Union(DatabaseError, ValidationError),
	}),
	Rpc.make("getSessions", {
		success: Schema.Array(SessionSchema),
		error: DatabaseError,
	}),
	Rpc.make("setActive", {
		payload: { id: Schema.String },
		success: Schema.Void,
		error: DatabaseError,
	}),
	Rpc.make("updateTitle", {
		payload: { id: Schema.String, title: Schema.String },
		success: SessionSchema,
		error: Schema.Union(DatabaseError, ValidationError),
	}),
	Rpc.make("reportNavigation", {
		payload: { id: Schema.String, url: Schema.String },
		success: SessionSchema,
		error: Schema.Union(DatabaseError, ValidationError),
	}),
	// Bookmark RPCs
	Rpc.make("getBookmarks", {
		success: Schema.Array(BookmarkSchema),
		error: DatabaseError,
	}),
	Rpc.make("addBookmark", {
		payload: { url: Schema.String, title: Schema.NullOr(Schema.String) },
		success: BookmarkSchema,
		error: DatabaseError,
	}),
	Rpc.make("removeBookmark", {
		payload: { id: Schema.String },
		success: Schema.Void,
		error: DatabaseError,
	}),
	Rpc.make("isBookmarked", {
		payload: { url: Schema.String },
		success: Schema.Boolean,
		error: DatabaseError,
	}),
	// History RPCs
	Rpc.make("getHistory", {
		success: Schema.Array(HistoryEntrySchema),
		error: DatabaseError,
	}),
	Rpc.make("clearHistory", {
		success: Schema.Void,
		error: DatabaseError,
	}),
	// Combined stream
	Rpc.make("browsingChanges", {
		success: BrowsingStateSchema,
		stream: true,
	}),
) {}
