import { Model } from "@effect/sql";
import { Schema } from "effect";

export class Page extends Model.Class<Page>("Page")({
	url: Schema.String,
	title: Schema.NullOr(Schema.String),
	loadedAt: Schema.String,
}) {}
