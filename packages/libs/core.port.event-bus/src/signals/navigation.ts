import { Schema } from "effect";
import * as Op from "./op";

export const NavigationSignals = {
	commands: {
		navigate: Op.command(
			"nav.navigate",
			Schema.Struct({ id: Schema.String, input: Schema.String }),
		),
		back: Op.command("nav.back", Schema.Struct({ id: Schema.String })),
		forward: Op.command("nav.forward", Schema.Struct({ id: Schema.String })),
		report: Op.command("nav.report", Schema.Struct({ id: Schema.String, url: Schema.String })),
		updateTitle: Op.command(
			"nav.update-title",
			Schema.Struct({ id: Schema.String, title: Schema.String }),
		),
	},
	events: {
		navigated: Op.event("nav.navigated", Schema.Struct({ id: Schema.String, url: Schema.String })),
		titleUpdated: Op.event(
			"nav.title-updated",
			Schema.Struct({ id: Schema.String, title: Schema.String }),
		),
	},
} as const;
