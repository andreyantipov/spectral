import type { GroupNode, LayoutNode, PanelRef, SplitNode } from "../model/layout.validators";

// -- Factory functions --------------------------------------------------------

export const makeGroupNode = (panels: readonly PanelRef[], activePanel: string): GroupNode => ({
	id: crypto.randomUUID(),
	type: "group",
	panels,
	activePanel,
});

export const makeSplitNode = (
	direction: "horizontal" | "vertical",
	children: readonly LayoutNode[],
	sizes: readonly number[],
): SplitNode => ({
	id: crypto.randomUUID(),
	type: "split",
	direction,
	children,
	sizes,
});

// -- New operations -----------------------------------------------------------

export const findAndResize = (
	node: LayoutNode,
	splitId: string,
	newSizes: readonly number[],
): LayoutNode => {
	if (node.type === "group") return node;
	if (node.id === splitId) return { ...node, sizes: newSizes };
	return { ...node, children: node.children.map((c) => findAndResize(c, splitId, newSizes)) };
};

export const findAndActivatePanel = (node: LayoutNode, panelId: string): LayoutNode => {
	if (node.type === "group") {
		if (node.panels.some((p) => p.id === panelId)) return { ...node, activePanel: panelId };
		return node;
	}
	return { ...node, children: node.children.map((c) => findAndActivatePanel(c, panelId)) };
};

export const findAndReorderPanel = (
	node: LayoutNode,
	groupId: string,
	panelId: string,
	index: number,
): LayoutNode => {
	if (node.type === "group") {
		if (node.id !== groupId) return node;
		const panel = node.panels.find((p) => p.id === panelId);
		if (!panel) return node;
		const without = node.panels.filter((p) => p.id !== panelId);
		const reordered = [...without.slice(0, index), panel, ...without.slice(index)];
		return { ...node, panels: reordered };
	}
	return {
		...node,
		children: node.children.map((c) => findAndReorderPanel(c, groupId, panelId, index)),
	};
};

export const findAndUpdateTabMeta = (
	node: LayoutNode,
	panelId: string,
	meta: { title?: string; icon?: string | null },
): LayoutNode => {
	if (node.type === "group") {
		if (!node.panels.some((p) => p.id === panelId)) return node;
		const updated = node.panels.map((p) => (p.id === panelId ? { ...p, ...meta } : p));
		return { ...node, panels: updated };
	}
	return { ...node, children: node.children.map((c) => findAndUpdateTabMeta(c, panelId, meta)) };
};

// -- Migrated from workspace.handlers.ts --------------------------------------

export const findAndSplitPanel = (
	node: LayoutNode,
	panelId: string,
	direction: "horizontal" | "vertical",
	newPanel: PanelRef,
): LayoutNode => {
	if (node.type === "group") {
		const group = node as GroupNode;
		const idx = group.panels.findIndex((p) => p.id === panelId);
		if (idx === -1) return node;
		const existingGroup = makeGroupNode(group.panels, group.activePanel);
		const newGroup = makeGroupNode([newPanel], newPanel.id);
		return makeSplitNode(direction, [existingGroup, newGroup], [0.5, 0.5]);
	}
	return {
		...node,
		children: (node as SplitNode).children.map((child) =>
			findAndSplitPanel(child, panelId, direction, newPanel),
		),
	};
};

export const findAndRemovePanel = (
	node: LayoutNode,
	panelId: string,
): { node: LayoutNode | null; removed: boolean } => {
	if (node.type === "group") {
		const group = node as GroupNode;
		const filtered = group.panels.filter((p) => p.id !== panelId);
		if (filtered.length === group.panels.length) return { node, removed: false };
		const activePanel = group.activePanel === panelId ? (filtered[0]?.id ?? "") : group.activePanel;
		return { node: { ...group, panels: filtered, activePanel }, removed: true };
	}
	const split = node as SplitNode;
	const children: LayoutNode[] = [];
	let removed = false;
	for (const child of split.children) {
		const result = findAndRemovePanel(child, panelId);
		removed = removed || result.removed;
		if (result.node) children.push(result.node);
	}
	if (children.length === 0) return { node: null, removed };
	if (children.length === 1) return { node: children[0], removed };
	return {
		node: { ...split, children, sizes: children.map(() => 1 / children.length) },
		removed,
	};
};

export const findAndMovePanel = (
	node: LayoutNode,
	panelId: string,
): { node: LayoutNode | null; panel: PanelRef | null } => {
	if (node.type === "group") {
		const group = node as GroupNode;
		const panel = group.panels.find((p) => p.id === panelId);
		if (!panel) return { node, panel: null };
		const filtered = group.panels.filter((p) => p.id !== panelId);
		const activePanel = group.activePanel === panelId ? (filtered[0]?.id ?? "") : group.activePanel;
		return {
			node: filtered.length > 0 ? { ...group, panels: filtered, activePanel } : null,
			panel,
		};
	}
	const split = node as SplitNode;
	const children: LayoutNode[] = [];
	let foundPanel: PanelRef | null = null;
	for (const child of split.children) {
		const result = findAndMovePanel(child, panelId);
		foundPanel = foundPanel || result.panel;
		if (result.node) children.push(result.node);
	}
	if (children.length === 0) return { node: null, panel: foundPanel };
	if (children.length === 1) return { node: children[0], panel: foundPanel };
	return {
		node: { ...split, children, sizes: children.map(() => 1 / children.length) },
		panel: foundPanel,
	};
};

export const insertPanelIntoGroup = (
	node: LayoutNode,
	targetGroupId: string,
	panel: PanelRef,
): LayoutNode => {
	if (node.type === "group") {
		const group = node as GroupNode;
		if (group.id === targetGroupId || group.panels.some((p) => p.id === targetGroupId)) {
			return { ...group, panels: [...group.panels, panel] };
		}
		return node;
	}
	return {
		...node,
		children: (node as SplitNode).children.map((child) =>
			insertPanelIntoGroup(child, targetGroupId, panel),
		),
	};
};
