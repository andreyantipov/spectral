import { Model } from "@effect/sql";
import { Schema } from "effect";
import { Page } from "./page";

export class Session extends Model.Class<Session>("Session")({
	id: Model.GeneratedByApp(Schema.String),
	pages: Schema.Array(Page),
	currentIndex: Schema.Number,
	mode: Schema.Literal("visual"),
	isActive: Schema.Boolean,
	createdAt: Schema.String,
	updatedAt: Schema.String,
}) {}
