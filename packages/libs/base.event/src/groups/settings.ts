import { ShortcutBindingSchema } from "@ctrl/base.schema";
import { EventGroup } from "@effect/experimental";
import { Schema } from "effect";

export const SettingsEvents = EventGroup.empty.add({
	tag: "settings.shortcuts",
	primaryKey: () => "global",
	payload: Schema.Struct({}),
	success: Schema.Array(ShortcutBindingSchema),
});
