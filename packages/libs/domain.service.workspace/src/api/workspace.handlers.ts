import { DatabaseError } from "@ctrl/core.base.errors";
import { withTracing } from "@ctrl/core.base.tracing";
import type { GroupNode, LayoutNode, PanelRef, SplitNode } from "@ctrl/domain.feature.layout";
import { LayoutFeature } from "@ctrl/domain.feature.layout";
import { Effect } from "effect";
import { WORKSPACE_SERVICE } from "../lib/constants";
import { WorkspaceRpcs } from "./workspace.rpc";

const findAndRemovePanel = (
	node: LayoutNode,
	panelId: string,
): { node: LayoutNode | null; removed: boolean } => {
	if (node.type === "group") {
		const filtered = node.panels.filter((p) => p.id !== panelId);
		if (filtered.length === node.panels.length) return { node, removed: false };
		const activePanel = node.activePanel === panelId ? (filtered[0]?.id ?? "") : node.activePanel;
		return { node: { ...node, panels: filtered, activePanel }, removed: true };
	}
	const children: LayoutNode[] = [];
	let removed = false;
	for (const child of node.children) {
		const result = findAndRemovePanel(child, panelId);
		removed = removed || result.removed;
		if (result.node) children.push(result.node);
	}
	if (children.length === 0) return { node: null, removed };
	if (children.length === 1) return { node: children[0], removed };
	return {
		node: { ...node, children, sizes: children.map(() => 1 / children.length) },
		removed,
	};
};

const findAndSplitPanel = (
	node: LayoutNode,
	panelId: string,
	direction: "horizontal" | "vertical",
	newPanel: PanelRef,
): LayoutNode => {
	if (node.type === "group") {
		const idx = node.panels.findIndex((p) => p.id === panelId);
		if (idx === -1) return node;
		const existingGroup: GroupNode = { ...node };
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
		children: node.children.map((child) => findAndSplitPanel(child, panelId, direction, newPanel)),
	};
};

type RemoveResult = { node: LayoutNode | null; panel: PanelRef | null };

const extractPanelFromGroup = (node: GroupNode, panelId: string): RemoveResult => {
	const panel = node.panels.find((p) => p.id === panelId);
	if (!panel) return { node, panel: null };
	const filtered = node.panels.filter((p) => p.id !== panelId);
	const activePanel = node.activePanel === panelId ? (filtered[0]?.id ?? "") : node.activePanel;
	return {
		node: filtered.length > 0 ? { ...node, panels: filtered, activePanel } : null,
		panel,
	};
};

const findAndMovePanel = (node: LayoutNode, panelId: string): RemoveResult => {
	if (node.type === "group") return extractPanelFromGroup(node, panelId);
	const children: LayoutNode[] = [];
	let foundPanel: PanelRef | null = null;
	for (const child of node.children) {
		const result = findAndMovePanel(child, panelId);
		foundPanel = foundPanel || result.panel;
		if (result.node) children.push(result.node);
	}
	if (children.length === 0) return { node: null, panel: foundPanel };
	if (children.length === 1) return { node: children[0], panel: foundPanel };
	return {
		node: { ...node, children, sizes: children.map(() => 1 / children.length) },
		panel: foundPanel,
	};
};

const insertPanelIntoGroup = (
	node: LayoutNode,
	targetGroupId: string,
	panel: PanelRef,
): LayoutNode => {
	if (node.type === "group") {
		if (node.activePanel === targetGroupId || node.panels.some((p) => p.id === targetGroupId)) {
			return { ...node, panels: [...node.panels, panel] };
		}
		return node;
	}
	return {
		...node,
		children: node.children.map((child) => insertPanelIntoGroup(child, targetGroupId, panel)),
	};
};

export const WorkspaceHandlersLive = WorkspaceRpcs.toLayer(
	Effect.gen(function* () {
		const layout = yield* LayoutFeature;

		return withTracing(WORKSPACE_SERVICE, {
			getLayout: () => layout.getLayout(),

			updateLayout: ({ layout: persistedLayout }) => layout.updateLayout(persistedLayout),

			splitPanel: ({ panelId, direction, newPanel }) =>
				Effect.gen(function* () {
					const current = yield* layout.getLayout();
					const updated = findAndSplitPanel(current, panelId, direction, newPanel);
					yield* layout.updateLayout({ version: 1, dockviewState: updated });
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to split panel", cause })),
					),
				),

			movePanel: ({ panelId, targetGroupId }) =>
				Effect.gen(function* () {
					const current = yield* layout.getLayout();
					const { node: stripped, panel } = findAndMovePanel(current, panelId);
					if (!panel || !stripped) return;
					const updated = insertPanelIntoGroup(stripped, targetGroupId, panel);
					yield* layout.updateLayout({ version: 1, dockviewState: updated });
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to move panel", cause })),
					),
				),

			closePanel: ({ panelId }) =>
				Effect.gen(function* () {
					const current = yield* layout.getLayout();
					const { node } = findAndRemovePanel(current, panelId);
					if (!node) return;
					yield* layout.updateLayout({ version: 1, dockviewState: node });
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to close panel", cause })),
					),
				),

			workspaceChanges: () => layout.changes,
		});
	}),
);
