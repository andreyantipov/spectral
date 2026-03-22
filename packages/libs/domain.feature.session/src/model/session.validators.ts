import { DEFAULT_TAB_URL } from "@ctrl/core.base.types";
import { Schema } from "effect";

export const CreateSessionInput = Schema.Struct({
	url: Schema.String.pipe(Schema.filter((s) => s.startsWith("http") || s === DEFAULT_TAB_URL)),
});
