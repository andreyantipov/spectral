import {
	BrowsingStateSchema,
	DatabaseError,
	SessionSchema,
	ValidationError,
} from "@ctrl/core.shared";
import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";

export class BrowsingRpcs extends RpcGroup.make(
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
		payload: { id: Schema.String, url: Schema.String },
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
	Rpc.make("sessionChanges", {
		success: BrowsingStateSchema,
		stream: true,
	}),
) {}
