import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { PanelDescriptorSchema } from "./panel.validators";

describe("Panel Schemas", () => {
	it("validates a session panel descriptor", () => {
		const result = Schema.decodeUnknownSync(PanelDescriptorSchema)({
			type: "session",
			label: "Web Page",
			icon: "globe",
		});
		expect(result.type).toBe("session");
	});

	it("validates a tool panel descriptor", () => {
		const result = Schema.decodeUnknownSync(PanelDescriptorSchema)({
			type: "tool",
			toolId: "bookmarks",
			label: "Bookmarks",
			icon: "bookmark",
		});
		expect(result.toolId).toBe("bookmarks");
	});
});
