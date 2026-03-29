import { Model } from "@effect/sql";
import { Schema } from "effect";

export class HistoryEntry extends Model.Class<HistoryEntry>("HistoryEntry")({
	id: Model.GeneratedByApp(Schema.String),
	url: Schema.String,
	title: Schema.NullOr(Schema.String),
	query: Schema.NullOr(Schema.String),
	visitedAt: Schema.String,
}) {}
