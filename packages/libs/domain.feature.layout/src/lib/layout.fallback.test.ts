import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { PersistedLayoutSchema } from "../model/layout.validators";

describe("Layout Fallback", () => {
	it("rejects corrupted JSON gracefully", () => {
		const result = Schema.decodeUnknownEither(PersistedLayoutSchema)({
			version: "not-a-number",
			dockviewState: null,
		});
		expect(result._tag).toBe("Left");
	});

	it("accepts valid layout", () => {
		const result = Schema.decodeUnknownEither(PersistedLayoutSchema)({
			version: 1,
			dockviewState: { panels: {} },
		});
		expect(result._tag).toBe("Right");
	});
});
