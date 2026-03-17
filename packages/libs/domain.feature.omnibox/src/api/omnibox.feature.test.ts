import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { OmniboxFeature } from "../model/omnibox.model";
import { OmniboxFeatureLive } from "./omnibox.feature";

const run = <A>(effect: Effect.Effect<A, never, OmniboxFeature>) =>
	Effect.runPromise(effect.pipe(Effect.provide(OmniboxFeatureLive)));

describe("OmniboxFeature", () => {
	it("resolves a bare domain as a URL", async () => {
		const result = await run(
			Effect.gen(function* () {
				const omnibox = yield* OmniboxFeature;
				return yield* omnibox.resolve("example.com");
			}),
		);
		expect(result.url).toBe("https://example.com");
		expect(result.query).toBeNull();
	});

	it("resolves a search query to Google", async () => {
		const result = await run(
			Effect.gen(function* () {
				const omnibox = yield* OmniboxFeature;
				return yield* omnibox.resolve("solid js");
			}),
		);
		expect(result.url).toBe("https://www.google.com/search?q=solid%20js");
		expect(result.query).toBe("solid js");
	});
});
