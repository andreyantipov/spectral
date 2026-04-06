import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { navigationEffects } from "./effects";

describe("navigation effects", () => {
	it("UrlIsValid returns true for https", async () => {
		const effects = await Effect.runPromise(navigationEffects);
		const result = await Effect.runPromise(
			effects.UrlIsValid({ url: "https://google.com" }),
		);
		expect(result).toBe(true);
	});

	it("UrlIsValid returns false for invalid url", async () => {
		const effects = await Effect.runPromise(navigationEffects);
		const result = await Effect.runPromise(effects.UrlIsValid({ url: "not-a-url" }));
		expect(result).toBe(false);
	});

	it("UrlIsValid accepts about:blank", async () => {
		const effects = await Effect.runPromise(navigationEffects);
		const result = await Effect.runPromise(effects.UrlIsValid({ url: "about:blank" }));
		expect(result).toBe(true);
	});

	it("UrlIsValid returns true for http", async () => {
		const effects = await Effect.runPromise(navigationEffects);
		const result = await Effect.runPromise(
			effects.UrlIsValid({ url: "http://localhost:3000" }),
		);
		expect(result).toBe(true);
	});

	it("UrlIsValid returns false for missing url", async () => {
		const effects = await Effect.runPromise(navigationEffects);
		const result = await Effect.runPromise(effects.UrlIsValid({}));
		expect(result).toBe(false);
	});

	it("StartNavigation is no-op", async () => {
		const effects = await Effect.runPromise(navigationEffects);
		await Effect.runPromise(effects.StartNavigation({ instanceId: "t1", url: "https://x.com" }));
	});
});
