import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Bookmark, HistoryEntry, Page, Session } from "./index";

describe("Model.Class definitions", () => {
	it("Session decodes from plain object", () => {
		const raw = {
			id: "s1",
			pages: [{ url: "https://example.com", title: "Example", loadedAt: "2026-01-01" }],
			currentIndex: 0,
			mode: "visual" as const,
			isActive: true,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		};
		const result = Schema.decodeUnknownSync(Session)(raw);
		expect(result.id).toBe("s1");
		expect(result.pages).toHaveLength(1);
	});

	it("Bookmark decodes from plain object", () => {
		const raw = { id: "b1", url: "https://example.com", title: "Example", createdAt: "2026-01-01" };
		const result = Schema.decodeUnknownSync(Bookmark)(raw);
		expect(result.id).toBe("b1");
	});

	it("HistoryEntry decodes from plain object", () => {
		const raw = {
			id: "h1",
			url: "https://example.com",
			title: null,
			query: "test",
			visitedAt: "2026-01-01",
		};
		const result = Schema.decodeUnknownSync(HistoryEntry)(raw);
		expect(result.id).toBe("h1");
		expect(result.query).toBe("test");
	});

	it("Page decodes from plain object", () => {
		const raw = { url: "https://example.com", title: "Example", loadedAt: "2026-01-01" };
		const result = Schema.decodeUnknownSync(Page)(raw);
		expect(result.url).toBe("https://example.com");
	});
});
