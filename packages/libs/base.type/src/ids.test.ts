import { describe, expect, it } from "vitest";
import { BookmarkId, SessionId } from "./ids";

describe("Branded IDs", () => {
	it("creates a SessionId from string", () => {
		const id = SessionId("abc-123");
		expect(id).toBe("abc-123");
	});

	it("creates a BookmarkId from string", () => {
		const id = BookmarkId("bm-456");
		expect(id).toBe("bm-456");
	});
});
