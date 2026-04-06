import { Schema } from "effect"

export class Navigate extends Schema.TaggedClass<Navigate>()("Navigate", {
	instanceId: Schema.String,
	url: Schema.String,
}) {}

export class UrlCommitted extends Schema.TaggedClass<UrlCommitted>()("UrlCommitted", {
	instanceId: Schema.String,
	url: Schema.String,
	title: Schema.String,
	favicon: Schema.String,
}) {}

export class TitleChanged extends Schema.TaggedClass<TitleChanged>()("TitleChanged", {
	instanceId: Schema.String,
	title: Schema.String,
}) {}

export class NavigationFailed extends Schema.TaggedClass<NavigationFailed>()("NavigationFailed", {
	instanceId: Schema.String,
	error: Schema.String,
}) {}
