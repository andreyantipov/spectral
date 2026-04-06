import { Schema } from "effect"

export class Page extends Schema.Class<Page>("Page")({
	url: Schema.String,
	title: Schema.NullOr(Schema.String),
	loadedAt: Schema.String,
}) {}
