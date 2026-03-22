import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
	GroupNodeSchema,
	LayoutNodeSchema,
	PanelRefSchema,
	SplitNodeSchema,
} from "./layout.validators";

describe("Layout Schemas", () => {
	it("validates a session PanelRef", () => {
		const result = Schema.decodeUnknownSync(PanelRefSchema)({
			id: "panel-1",
			type: "session",
			sessionId: "session-abc",
		});
		expect(result.id).toBe("panel-1");
		expect(result.type).toBe("session");
		expect(result.sessionId).toBe("session-abc");
	});

	it("validates a tool PanelRef", () => {
		const result = Schema.decodeUnknownSync(PanelRefSchema)({
			id: "panel-2",
			type: "tool",
			toolId: "bookmarks",
		});
		expect(result.type).toBe("tool");
		expect(result.toolId).toBe("bookmarks");
	});

	it("validates a GroupNode", () => {
		const result = Schema.decodeUnknownSync(GroupNodeSchema)({
			type: "group",
			panels: [{ id: "p1", type: "session", sessionId: "s1" }],
			activePanel: "p1",
		});
		expect(result.type).toBe("group");
		expect(result.panels).toHaveLength(1);
	});

	it("validates a SplitNode", () => {
		const result = Schema.decodeUnknownSync(SplitNodeSchema)({
			type: "split",
			direction: "horizontal",
			children: [
				{
					type: "group",
					panels: [{ id: "p1", type: "session", sessionId: "s1" }],
					activePanel: "p1",
				},
				{
					type: "group",
					panels: [{ id: "p2", type: "session", sessionId: "s2" }],
					activePanel: "p2",
				},
			],
			sizes: [0.5, 0.5],
		});
		expect(result.direction).toBe("horizontal");
		expect(result.children).toHaveLength(2);
		expect(result.sizes).toEqual([0.5, 0.5]);
	});

	it("validates nested layout tree", () => {
		const tree = {
			type: "split",
			direction: "horizontal",
			children: [
				{
					type: "group",
					panels: [{ id: "p1", type: "session", sessionId: "s1" }],
					activePanel: "p1",
				},
				{
					type: "split",
					direction: "vertical",
					children: [
						{
							type: "group",
							panels: [{ id: "p2", type: "tool", toolId: "bookmarks" }],
							activePanel: "p2",
						},
						{
							type: "group",
							panels: [{ id: "p3", type: "session", sessionId: "s3" }],
							activePanel: "p3",
						},
					],
					sizes: [0.4, 0.6],
				},
			],
			sizes: [0.5, 0.5],
		};
		const result = Schema.decodeUnknownSync(LayoutNodeSchema)(tree);
		expect(result.type).toBe("split");
	});

	it("rejects invalid direction", () => {
		expect(() =>
			Schema.decodeUnknownSync(SplitNodeSchema)({
				type: "split",
				direction: "diagonal",
				children: [],
				sizes: [],
			}),
		).toThrow();
	});
});
