import { WorkspaceEvents } from "@ctrl/core.contract.event-bus";
import type { GroupNode, LayoutNode, PanelRef, SplitNode } from "@ctrl/domain.feature.layout";
import { LayoutFeature } from "@ctrl/domain.feature.layout";
import { EventLog } from "@effect/experimental";
import { Effect } from "effect";

// -- Workspace layout helpers -------------------------------------------------

const findAndSplitPanel = (
	node: LayoutNode,
	panelId: string,
	direction: "horizontal" | "vertical",
	newPanel: PanelRef,
): LayoutNode => {
	if (node.type === "group") {
		const idx = (node as GroupNode).panels.findIndex((p) => p.id === panelId);
		if (idx === -1) return node;
		const existingGroup: GroupNode = { ...(node as GroupNode) };
		const newGroup: GroupNode = {
			type: "group",
			panels: [newPanel],
			activePanel: newPanel.id,
		};
		const split: SplitNode = {
			type: "split",
			direction,
			children: [existingGroup, newGroup],
			sizes: [0.5, 0.5],
		};
		return split;
	}
	return {
		...node,
		children: (node as SplitNode).children.map((child) =>
			findAndSplitPanel(child, panelId, direction, newPanel),
		),
	};
};

const findAndRemovePanel = (
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

const findAndMovePanel = (
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

const insertPanelIntoGroup = (
	node: LayoutNode,
	targetGroupId: string,
	panel: PanelRef,
): LayoutNode => {
	if (node.type === "group") {
		const group = node as GroupNode;
		if (group.activePanel === targetGroupId || group.panels.some((p) => p.id === targetGroupId)) {
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

// -- Workspace EventLog handlers ----------------------------------------------

export const WorkspaceHandlers = EventLog.group(WorkspaceEvents, (h) =>
	h
		.handle("ws.update-layout", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				yield* layout.updateLayout(payload.layout);
			}),
		)
		.handle("ws.split-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const updated = findAndSplitPanel(
					current,
					payload.panelId,
					payload.direction,
					payload.newPanel,
				);
				yield* layout.updateLayout({ version: 1, dockviewState: updated });
			}),
		)
		.handle("ws.move-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const { node: stripped, panel } = findAndMovePanel(current, payload.panelId);
				if (!panel || !stripped) return;
				const updated = insertPanelIntoGroup(stripped, payload.targetGroupId, panel);
				yield* layout.updateLayout({ version: 1, dockviewState: updated });
			}),
		)
		.handle("ws.close-panel", ({ payload }) =>
			Effect.gen(function* () {
				const layout = yield* LayoutFeature;
				const current = yield* layout.getLayout();
				const { node } = findAndRemovePanel(current, payload.panelId);
				if (!node) return;
				yield* layout.updateLayout({ version: 1, dockviewState: node });
			}),
		),
);
