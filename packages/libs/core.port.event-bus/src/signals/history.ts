import { Schema } from "effect";
import * as Op from "./op";

export const HistorySignals = {
	commands: {
		clear: Op.command("hist.clear", Schema.Void),
	},
	events: {
		cleared: Op.event("hist.cleared", Schema.Void),
	},
} as const;
