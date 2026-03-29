import type { ShortcutBinding } from "@ctrl/base.schema";
import { withTracing } from "@ctrl/base.tracing";
import { Context, Effect, Layer } from "effect";
import { DEFAULT_SHORTCUTS } from "../model/default-shortcuts";

const SETTINGS_FEATURE = "SettingsFeature";

export class SettingsFeature extends Context.Tag(SETTINGS_FEATURE)<
	SettingsFeature,
	{
		readonly getShortcuts: () => Effect.Effect<readonly ShortcutBinding[]>;
	}
>() {}

export const SettingsFeatureLive = Layer.effect(
	SettingsFeature,
	Effect.sync(() =>
		withTracing(SETTINGS_FEATURE, {
			getShortcuts: () => Effect.succeed(DEFAULT_SHORTCUTS),
		}),
	),
);
