import { Schema } from "effect";
import * as Op from "./op";

export const WorkspaceSignals = {
	commands: {
		splitRight: Op.command(
			"ws.split-right",
			Schema.Struct({ sessionId: Schema.optional(Schema.String) }),
		),
		splitDown: Op.command(
			"ws.split-down",
			Schema.Struct({ sessionId: Schema.optional(Schema.String) }),
		),
		closePane: Op.command(
			"ws.close-pane",
			Schema.Struct({ paneId: Schema.optional(Schema.String) }),
		),
		focusPane: Op.command("ws.focus-pane", Schema.Struct({ paneId: Schema.String })),
	},
	events: {
		layoutChanged: Op.event("ws.layout-changed", Schema.Unknown),
		paneSplit: Op.event(
			"ws.pane-split",
			Schema.Struct({ direction: Schema.Literal("right", "down") }),
		),
	},
} as const;
