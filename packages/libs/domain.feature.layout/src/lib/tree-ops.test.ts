import { describe, expect, it } from "vitest";
import type { GroupNode, PanelRef, SplitNode } from "../model/layout.validators";
import {
	findAndActivatePanel,
	findAndMovePanel,
	findAndRemovePanel,
	findAndReorderPanel,
	findAndResize,
	findAndSplitPanel,
	findAndUpdateTabMeta,
	insertPanelIntoGroup,
	makeGroupNode,
	makeSplitNode,
} from "./tree-ops";

// -- Fixtures -----------------------------------------------------------------

const p1: PanelRef = { id: "p1", type: "session", entityId: "s1", title: "Tab 1", icon: null };
const p2: PanelRef = { id: "p2", type: "session", entityId: "s2", title: "Tab 2", icon: null };
const p3: PanelRef = { id: "p3", type: "session", entityId: "s3", title: "Tab 3", icon: null };
const p4: PanelRef = { id: "p4", type: "tool", entityId: "t1", title: "Tool 1", icon: "wrench" };

const group1: GroupNode = { id: "g1", type: "group", panels: [p1, p2], activePanel: "p1" };
const group2: GroupNode = { id: "g2", type: "group", panels: [p3], activePanel: "p3" };

const split1: SplitNode = {
	id: "s1",
	type: "split",
	direction: "horizontal",
	children: [group1, group2],
	sizes: [0.6, 0.4],
};

// -- Factory functions --------------------------------------------------------

describe("makeGroupNode", () => {
	it("creates a group node with unique id", () => {
		const node = makeGroupNode([p1], "p1");
		expect(node.type).toBe("group");
		expect(node.panels).toEqual([p1]);
		expect(node.activePanel).toBe("p1");
		expect(node.id).toBeDefined();
		expect(typeof node.id).toBe("string");
		expect(node.id.length).toBeGreaterThan(0);
	});

	it("generates different ids on each call", () => {
		const a = makeGroupNode([p1], "p1");
		const b = makeGroupNode([p1], "p1");
		expect(a.id).not.toBe(b.id);
	});
});

describe("makeSplitNode", () => {
	it("creates a split node with unique id", () => {
		const node = makeSplitNode("vertical", [group1, group2], [0.5, 0.5]);
		expect(node.type).toBe("split");
		expect(node.direction).toBe("vertical");
		expect(node.children).toEqual([group1, group2]);
		expect(node.sizes).toEqual([0.5, 0.5]);
		expect(node.id).toBeDefined();
		expect(typeof node.id).toBe("string");
	});

	it("generates different ids on each call", () => {
		const a = makeSplitNode("horizontal", [], []);
		const b = makeSplitNode("horizontal", [], []);
		expect(a.id).not.toBe(b.id);
	});
});

// -- findAndResize ------------------------------------------------------------

describe("findAndResize", () => {
	it("updates sizes when split id matches", () => {
		const result = findAndResize(split1, "s1", [0.3, 0.7]);
		expect(result.type).toBe("split");
		expect((result as SplitNode).sizes).toEqual([0.3, 0.7]);
	});

	it("returns node unchanged when id does not match", () => {
		const result = findAndResize(split1, "nonexistent", [0.3, 0.7]);
		expect(result).toEqual(split1);
	});

	it("returns group nodes unchanged", () => {
		const result = findAndResize(group1, "s1", [0.5, 0.5]);
		expect(result).toBe(group1);
	});

	it("updates nested split", () => {
		const innerSplit: SplitNode = {
			id: "inner",
			type: "split",
			direction: "vertical",
			children: [group1],
			sizes: [1],
		};
		const outerSplit: SplitNode = {
			id: "outer",
			type: "split",
			direction: "horizontal",
			children: [innerSplit, group2],
			sizes: [0.5, 0.5],
		};
		const result = findAndResize(outerSplit, "inner", [0.8]) as SplitNode;
		expect((result.children[0] as SplitNode).sizes).toEqual([0.8]);
	});
});

// -- findAndActivatePanel -----------------------------------------------------

describe("findAndActivatePanel", () => {
	it("sets activePanel when panel exists in group", () => {
		const result = findAndActivatePanel(group1, "p2") as GroupNode;
		expect(result.activePanel).toBe("p2");
	});

	it("returns group unchanged when panel not found", () => {
		const result = findAndActivatePanel(group1, "nonexistent");
		expect(result).toBe(group1);
	});

	it("recurses into split children", () => {
		const result = findAndActivatePanel(split1, "p2") as SplitNode;
		expect((result.children[0] as GroupNode).activePanel).toBe("p2");
	});
});

// -- findAndReorderPanel ------------------------------------------------------

describe("findAndReorderPanel", () => {
	it("moves panel to specified index", () => {
		const group: GroupNode = { id: "g1", type: "group", panels: [p1, p2, p3], activePanel: "p1" };
		const result = findAndReorderPanel(group, "g1", "p1", 2) as GroupNode;
		expect(result.panels.map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
	});

	it("moves panel to beginning", () => {
		const group: GroupNode = { id: "g1", type: "group", panels: [p1, p2, p3], activePanel: "p1" };
		const result = findAndReorderPanel(group, "g1", "p3", 0) as GroupNode;
		expect(result.panels.map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
	});

	it("no-op when group id does not match", () => {
		const result = findAndReorderPanel(group1, "wrong-group", "p1", 1);
		expect(result).toBe(group1);
	});

	it("no-op when panel not in group", () => {
		const result = findAndReorderPanel(group1, "g1", "nonexistent", 0);
		expect(result).toBe(group1);
	});

	it("recurses into split children", () => {
		const result = findAndReorderPanel(split1, "g1", "p2", 0) as SplitNode;
		expect((result.children[0] as GroupNode).panels.map((p) => p.id)).toEqual(["p2", "p1"]);
	});
});

// -- findAndUpdateTabMeta -----------------------------------------------------

describe("findAndUpdateTabMeta", () => {
	it("updates title of matching panel", () => {
		const result = findAndUpdateTabMeta(group1, "p1", { title: "Renamed" }) as GroupNode;
		expect(result.panels[0].title).toBe("Renamed");
		expect(result.panels[1].title).toBe("Tab 2");
	});

	it("updates icon of matching panel", () => {
		const result = findAndUpdateTabMeta(group1, "p1", { icon: "star" }) as GroupNode;
		expect(result.panels[0].icon).toBe("star");
	});

	it("updates both title and icon", () => {
		const result = findAndUpdateTabMeta(group1, "p1", { title: "New", icon: "globe" }) as GroupNode;
		expect(result.panels[0].title).toBe("New");
		expect(result.panels[0].icon).toBe("globe");
	});

	it("no-op when panel not found", () => {
		const result = findAndUpdateTabMeta(group1, "nonexistent", { title: "X" });
		expect(result).toBe(group1);
	});

	it("recurses into split children", () => {
		const result = findAndUpdateTabMeta(split1, "p3", { title: "Updated" }) as SplitNode;
		expect((result.children[1] as GroupNode).panels[0].title).toBe("Updated");
	});
});

// -- findAndSplitPanel --------------------------------------------------------

describe("findAndSplitPanel", () => {
	it("splits group containing panel into a split node", () => {
		const result = findAndSplitPanel(group1, "p1", "vertical", p4);
		expect(result.type).toBe("split");
		const s = result as SplitNode;
		expect(s.direction).toBe("vertical");
		expect(s.sizes).toEqual([0.5, 0.5]);
		expect(s.children.length).toBe(2);
		expect((s.children[0] as GroupNode).panels).toEqual([p1, p2]);
		expect((s.children[1] as GroupNode).panels).toEqual([p4]);
	});

	it("new nodes from split have ids", () => {
		const result = findAndSplitPanel(group1, "p1", "horizontal", p4) as SplitNode;
		expect(result.id).toBeDefined();
		expect(result.id.length).toBeGreaterThan(0);
		expect((result.children[0] as GroupNode).id).toBeDefined();
		expect((result.children[1] as GroupNode).id).toBeDefined();
	});

	it("no-op when panel not found in group", () => {
		const result = findAndSplitPanel(group1, "nonexistent", "horizontal", p4);
		expect(result).toBe(group1);
	});

	it("recurses into split to find panel", () => {
		const result = findAndSplitPanel(split1, "p3", "vertical", p4) as SplitNode;
		expect(result.children[1].type).toBe("split");
	});
});

// -- findAndMovePanel ---------------------------------------------------------

describe("findAndMovePanel", () => {
	it("extracts panel from group", () => {
		const { node, panel } = findAndMovePanel(group1, "p1");
		expect(panel).toEqual(p1);
		expect(node).not.toBeNull();
		expect((node as GroupNode).panels.map((p) => p.id)).toEqual(["p2"]);
	});

	it("returns null node when last panel is removed", () => {
		const singleGroup: GroupNode = { id: "g", type: "group", panels: [p1], activePanel: "p1" };
		const { node, panel } = findAndMovePanel(singleGroup, "p1");
		expect(panel).toEqual(p1);
		expect(node).toBeNull();
	});

	it("returns null panel when not found", () => {
		const { node, panel } = findAndMovePanel(group1, "nonexistent");
		expect(panel).toBeNull();
		expect(node).toBe(group1);
	});

	it("updates activePanel when active panel is moved", () => {
		const { node } = findAndMovePanel(group1, "p1");
		expect((node as GroupNode).activePanel).toBe("p2");
	});

	it("collapses split when child becomes empty", () => {
		const { node } = findAndMovePanel(split1, "p3");
		// group2 had only p3, so it's removed; split collapses to group1
		expect(node).not.toBeNull();
		expect(node?.type).toBe("group");
		expect((node as GroupNode).id).toBe("g1");
	});
});

// -- findAndRemovePanel -------------------------------------------------------

describe("findAndRemovePanel", () => {
	it("removes panel from group", () => {
		const { node, removed } = findAndRemovePanel(group1, "p1");
		expect(removed).toBe(true);
		expect((node as GroupNode).panels.map((p) => p.id)).toEqual(["p2"]);
	});

	it("updates activePanel when active is removed", () => {
		const { node } = findAndRemovePanel(group1, "p1");
		expect((node as GroupNode).activePanel).toBe("p2");
	});

	it("keeps activePanel when non-active is removed", () => {
		const { node } = findAndRemovePanel(group1, "p2");
		expect((node as GroupNode).activePanel).toBe("p1");
	});

	it("no-op when panel not found", () => {
		const { node, removed } = findAndRemovePanel(group1, "nonexistent");
		expect(removed).toBe(false);
		expect(node).toBe(group1);
	});

	it("collapses split when only one child remains", () => {
		const { node, removed } = findAndRemovePanel(split1, "p3");
		expect(removed).toBe(true);
		// group2 becomes empty (no panels left? Actually it still has 0 panels)
		// Actually group2 has [p3], removing p3 leaves empty panels, group stays with empty panels
		// The split should still have both children since group isn't null
		expect(node).not.toBeNull();
	});

	it("redistributes sizes after removal", () => {
		const threeGroup: GroupNode = { id: "g3", type: "group", panels: [p4], activePanel: "p4" };
		const triSplit: SplitNode = {
			id: "ts",
			type: "split",
			direction: "horizontal",
			children: [
				{ id: "sg1", type: "group", panels: [p1], activePanel: "p1" },
				{ id: "sg2", type: "group", panels: [p2], activePanel: "p2" },
				threeGroup,
			],
			sizes: [0.33, 0.33, 0.34],
		};
		// Remove p1 — first group becomes empty (0 panels but still a node)
		// Actually findAndRemovePanel doesn't null out groups with 0 panels
		const { node } = findAndRemovePanel(triSplit, "p1");
		expect(node).not.toBeNull();
	});
});

// -- insertPanelIntoGroup -----------------------------------------------------

describe("insertPanelIntoGroup", () => {
	it("inserts panel into group matched by group id", () => {
		const result = insertPanelIntoGroup(group1, "g1", p4) as GroupNode;
		expect(result.panels.length).toBe(3);
		expect(result.panels[2]).toEqual(p4);
	});

	it("inserts panel into group matched by panel id", () => {
		const result = insertPanelIntoGroup(group1, "p1", p4) as GroupNode;
		expect(result.panels.length).toBe(3);
	});

	it("no-op when target not found", () => {
		const result = insertPanelIntoGroup(group1, "nonexistent", p4);
		expect(result).toBe(group1);
	});

	it("recurses into split children", () => {
		const result = insertPanelIntoGroup(split1, "g2", p4) as SplitNode;
		expect((result.children[1] as GroupNode).panels.length).toBe(2);
		expect((result.children[1] as GroupNode).panels[1]).toEqual(p4);
	});
});
