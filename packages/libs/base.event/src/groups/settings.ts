import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";
import { ShortcutBindingSchema } from "@ctrl/base.schema";

export const SettingsEvents = EventGroup.empty.add({
	tag: "settings.shortcuts",
	primaryKey: () => "global",
	payload: Schema.Struct({}),
	success: Schema.Array(ShortcutBindingSchema),
});
