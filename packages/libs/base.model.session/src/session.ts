import { Schema } from "effect"
import { Page } from "./page"

export class Session extends Schema.Class<Session>("Session")({
	id: Schema.String,
	pages: Schema.Array(Page),
	currentIndex: Schema.Number,
	mode: Schema.Literal("visual"),
	isActive: Schema.Boolean,
	createdAt: Schema.String,
	updatedAt: Schema.String,
}) {}
