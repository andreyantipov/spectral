import type { Effect } from "effect";
import { Context, Schema } from "effect";
import { OMNIBOX_FEATURE } from "../lib/constants";

export const OmniboxResultSchema = Schema.Struct({
	url: Schema.String,
	query: Schema.NullOr(Schema.String),
});

export type OmniboxResult = typeof OmniboxResultSchema.Type;

export type SearchEngine = {
	readonly name: string;
	readonly buildUrl: (query: string) => string;
};

export class OmniboxFeature extends Context.Tag(OMNIBOX_FEATURE)<
	OmniboxFeature,
	{
		readonly resolve: (input: string) => Effect.Effect<OmniboxResult>;
	}
>() {}
