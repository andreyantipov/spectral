import { Schema } from "effect";
import * as Op from "./op";

export const UISignals = {
	commands: {
		toggleOmnibox: Op.command("ui.toggle-omnibox", Schema.Void),
		toggleSidebar: Op.command("ui.toggle-sidebar", Schema.Void),
	},
} as const;
