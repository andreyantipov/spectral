import { Schema } from "effect";
import * as Op from "./op";

export const AgentSignals = {
	commands: {
		createHeadless: Op.command("agent.create-headless", Schema.Struct({ url: Schema.String })),
		evaluateJs: Op.command("agent.evaluate-js", Schema.Struct({ script: Schema.String })),
		closeHeadless: Op.command("agent.close-headless", Schema.Void),
	},
} as const;
