import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { Effects } from "@ctrl/base.op.browsing"
import { navigationEffects } from "./effects"

describe("navigation effects", () => {
	it("url.isValid returns true for https", async () => {
		const effects = await Effect.runPromise(navigationEffects)
		const result = await Effect.runPromise(
			effects[Effects.URL_IS_VALID]({ url: "https://google.com" }),
		)
		expect(result).toBe(true)
	})

	it("url.isValid returns false for invalid url", async () => {
		const effects = await Effect.runPromise(navigationEffects)
		const result = await Effect.runPromise(
			effects[Effects.URL_IS_VALID]({ url: "not-a-url" }),
		)
		expect(result).toBe(false)
	})

	it("url.isValid accepts about:blank", async () => {
		const effects = await Effect.runPromise(navigationEffects)
		const result = await Effect.runPromise(
			effects[Effects.URL_IS_VALID]({ url: "about:blank" }),
		)
		expect(result).toBe(true)
	})

	it("url.isValid returns true for http", async () => {
		const effects = await Effect.runPromise(navigationEffects)
		const result = await Effect.runPromise(
			effects[Effects.URL_IS_VALID]({ url: "http://localhost:3000" }),
		)
		expect(result).toBe(true)
	})

	it("url.isValid returns false for missing url", async () => {
		const effects = await Effect.runPromise(navigationEffects)
		const result = await Effect.runPromise(
			effects[Effects.URL_IS_VALID]({}),
		)
		expect(result).toBe(false)
	})

	it("nav.start is no-op", async () => {
		const effects = await Effect.runPromise(navigationEffects)
		await Effect.runPromise(
			effects[Effects.NAV_START]({ instanceId: "t1", url: "https://x.com" }),
		)
	})

	it("nav.cancel is no-op", async () => {
		const effects = await Effect.runPromise(navigationEffects)
		await Effect.runPromise(
			effects[Effects.NAV_CANCEL]({ instanceId: "t1" }),
		)
	})
})
