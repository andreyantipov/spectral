import { Schema } from "effect";
import * as Op from "./op";

export const BookmarkSignals = {
	commands: {
		add: Op.command(
			"bm.add",
			Schema.Struct({ url: Schema.String, title: Schema.NullOr(Schema.String) }),
		),
		remove: Op.command("bm.remove", Schema.Struct({ id: Schema.String })),
	},
	events: {
		added: Op.event("bm.added", Schema.Struct({ id: Schema.String, url: Schema.String })),
		removed: Op.event("bm.removed", Schema.Struct({ id: Schema.String })),
	},
} as const;
