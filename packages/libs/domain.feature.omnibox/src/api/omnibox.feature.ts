import { Effect, Layer } from "effect";
import { resolveInput } from "../lib/resolve";
import type { SearchEngine } from "../model/omnibox.model";
import { OmniboxFeature } from "../model/omnibox.model";

const GoogleEngine: SearchEngine = {
	name: "Google",
	buildUrl: (query) => `https://www.google.com/search?q=${query}`,
};

export const OmniboxFeatureLive = Layer.succeed(OmniboxFeature, {
	resolve: (input) => Effect.sync(() => resolveInput(input, GoogleEngine)),
});
