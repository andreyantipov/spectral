import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
	GroupNodeSchema,
	LayoutNodeSchema,
	PanelRefSchema,
	PersistedLayoutSchema,
	SplitNodeSchema,
} from "./layout.validators";

describe("Layout Schemas", () => {
	it("validates a session PanelRef", () => {
		const result = Schema.decodeUnknownSync(PanelRefSchema)({
			id: "panel-1",
			type: "session",
			entityId: "session-abc",
			icon: null,
		});
		expect(result.id).toBe("panel-1");
		expect(result.type).toBe("session");
		expect(result.entityId).toBe("session-abc");
		expect(result.title).toBe("New Tab");
		expect(result.icon).toBeNull();
	});

	it("validates a tool PanelRef", () => {
		const result = Schema.decodeUnknownSync(PanelRefSchema)({
			id: "panel-2",
			type: "tool",
			entityId: "bookmarks",
			title: "Bookmarks",
			icon: "bookmark-icon",
		});
		expect(result.type).toBe("tool");
		expect(result.entityId).toBe("bookmarks");
		expect(result.title).toBe("Bookmarks");
		expect(result.icon).toBe("bookmark-icon");
	});

	it("validates a GroupNode", () => {
		const result = Schema.decodeUnknownSync(GroupNodeSchema)({
			id: "group-1",
			type: "group",
			panels: [{ id: "p1", type: "session", entityId: "s1", icon: null }],
			activePanel: "p1",
		});
		expect(result.type).toBe("group");
		expect(result.panels).toHaveLength(1);
		expect(result.id).toBe("group-1");
	});

	it("validates a SplitNode", () => {
		const result = Schema.decodeUnknownSync(SplitNodeSchema)({
			id: "split-1",
			type: "split",
			direction: "horizontal",
			children: [
				{
					id: "group-1",
					type: "group",
					panels: [{ id: "p1", type: "session", entityId: "s1", icon: null }],
					activePanel: "p1",
				},
				{
					id: "group-2",
					type: "group",
					panels: [{ id: "p2", type: "session", entityId: "s2", icon: null }],
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
			id: "split-root",
			type: "split",
			direction: "horizontal",
			children: [
				{
					id: "group-1",
					type: "group",
					panels: [{ id: "p1", type: "session", entityId: "s1", icon: null }],
					activePanel: "p1",
				},
				{
					id: "split-nested",
					type: "split",
					direction: "vertical",
					children: [
						{
							id: "group-2",
							type: "group",
							panels: [
								{
									id: "p2",
									type: "tool",
									entityId: "bookmarks",
									icon: "bookmark-icon",
								},
							],
							activePanel: "p2",
						},
						{
							id: "group-3",
							type: "group",
							panels: [
								{
									id: "p3",
									type: "session",
									entityId: "s3",
									icon: null,
								},
							],
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
				id: "split-1",
				type: "split",
				direction: "diagonal",
				children: [],
				sizes: [],
			}),
		).toThrow();
	});

	it("rejects v1 format with dockviewState", () => {
		expect(() =>
			Schema.decodeUnknownSync(PersistedLayoutSchema)({
				version: 1,
				dockviewState: { panels: {} },
			}),
		).toThrow();
	});

	it("validates v2 PersistedLayout", () => {
		const result = Schema.decodeUnknownSync(PersistedLayoutSchema)({
			version: 2,
			root: {
				id: "group-1",
				type: "group",
				panels: [{ id: "p1", type: "session", entityId: "s1", icon: null }],
				activePanel: "p1",
			},
		});
		expect(result.version).toBe(2);
		expect(result.root.type).toBe("group");
	});
});
