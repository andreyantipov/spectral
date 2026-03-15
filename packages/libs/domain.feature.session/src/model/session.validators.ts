import { DEFAULT_TAB_URL } from "@ctrl/core.shared";
import { Schema } from "effect";

export const CreateSessionInput = Schema.Struct({
	url: Schema.String.pipe(Schema.filter((s) => s.startsWith("http") || s === DEFAULT_TAB_URL)),
});
