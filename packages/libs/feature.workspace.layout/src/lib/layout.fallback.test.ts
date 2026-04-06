import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { PersistedLayoutSchema } from "../model/layout.validators";

describe("Layout Fallback", () => {
	it("rejects corrupted JSON gracefully", () => {
		const result = Schema.decodeUnknownEither(PersistedLayoutSchema)({
			version: "not-a-number",
			root: null,
		});
		expect(result._tag).toBe("Left");
	});

	it("accepts valid layout", () => {
		const result = Schema.decodeUnknownEither(PersistedLayoutSchema)({
			version: 2,
			root: {
				id: "g1",
				type: "group",
				panels: [],
				activePanel: "",
			},
		});
		expect(result._tag).toBe("Right");
	});
});
