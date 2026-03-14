import { Schema } from "effect";

export const PageSchema = Schema.Struct({
	url: Schema.String,
	title: Schema.NullOr(Schema.String),
	loadedAt: Schema.String,
});

export const SessionSchema = Schema.Struct({
	id: Schema.String,
	pages: Schema.Array(PageSchema),
	currentIndex: Schema.Number,
	mode: Schema.Literal("visual"),
	isActive: Schema.Boolean,
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

export const BrowsingStateSchema = Schema.Struct({
	sessions: Schema.Array(SessionSchema),
});

// Types derived from schemas — no manual definitions
export type Page = typeof PageSchema.Type;
export type Session = typeof SessionSchema.Type;
export type BrowsingState = typeof BrowsingStateSchema.Type;
