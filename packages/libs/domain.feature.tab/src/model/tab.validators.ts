import { Schema } from "effect";

export const CreateTabInput = Schema.Struct({
	url: Schema.String.pipe(Schema.filter((s) => s.startsWith("http") || s === "about:blank")),
});
