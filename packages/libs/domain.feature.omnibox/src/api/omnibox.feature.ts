import { withTracing } from "@ctrl/core.base.tracing";
import { Effect, Layer } from "effect";
import { OMNIBOX_FEATURE } from "../lib/constants";
import { resolveInput } from "../lib/resolve";
import type { SearchEngine } from "../model/omnibox.model";
import { OmniboxFeature } from "../model/omnibox.model";

const GoogleEngine: SearchEngine = {
	name: "Google",
	buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
};

export const OmniboxFeatureLive = Layer.succeed(
	OmniboxFeature,
	withTracing(OMNIBOX_FEATURE, {
		resolve: (input) => Effect.sync(() => resolveInput(input, GoogleEngine)),
	}),
);
