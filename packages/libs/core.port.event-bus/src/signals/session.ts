import { Schema } from "effect";
import * as Op from "./op";

export const SessionSignals = {
	commands: {
		create: Op.command("session.create", Schema.Struct({ mode: Schema.Literal("visual") })),
		close: Op.command("session.close", Schema.Struct({ id: Schema.String })),
		activate: Op.command("session.activate", Schema.Struct({ id: Schema.String })),
	},
	events: {
		created: Op.event(
			"session.created",
			Schema.Struct({ id: Schema.String, mode: Schema.Literal("visual") }),
		),
		closed: Op.event("session.closed", Schema.Struct({ id: Schema.String })),
		activated: Op.event("session.activated", Schema.Struct({ id: Schema.String })),
	},
} as const;
