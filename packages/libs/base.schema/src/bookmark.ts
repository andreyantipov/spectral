import { Model } from "@effect/sql";
import { Schema } from "effect";

export class Bookmark extends Model.Class<Bookmark>("Bookmark")({
	id: Model.GeneratedByApp(Schema.String),
	url: Schema.String,
	title: Schema.NullOr(Schema.String),
	createdAt: Schema.String,
}) {}
