import { Schema } from "effect";
import * as Op from "./op";

export const DiagnosticSignals = {
	commands: {
		ping: Op.command("diag.ping", Schema.Void),
	},
	events: {
		pong: Op.event("diag.pong", Schema.Struct({ timestamp: Schema.Number })),
	},
} as const;
