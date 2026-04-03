import type { GroupNode, PanelRef } from "@ctrl/base.schema";
import type { Component, JSX } from "solid-js";
import { createMemo, For } from "solid-js";
import type { WorkspaceCommand } from "./types";
import { workspace } from "./workspace.style";

export type GroupRendererProps = {
	node: GroupNode;
	focusedGroupId: string | null;
	renderViewport: (panel: PanelRef) => JSX.Element;
	onCommand: (cmd: WorkspaceCommand) => void;
	onGroupFocus: (groupId: string) => void;
};

/**
 * Stabilize panel references so Solid's <For> doesn't recreate children
 * when workspace state syncs produce new objects with the same IDs.
 * Without this, every state-sync destroys and recreates all webviews,
 * losing cookies, scroll position, and JS state.
 */
function useStablePanels(getPanels: () => readonly PanelRef[]): () => PanelRef[] {
	const cache = new Map<string, PanelRef>();

	return createMemo(() => {
		const incoming = getPanels();
		const seen = new Set<string>();
		const result: PanelRef[] = [];

		for (const panel of incoming) {
			seen.add(panel.id);
			const cached = cache.get(panel.id);
			if (cached && cached.entityId === panel.entityId && cached.type === panel.type) {
				// Reuse the same reference — <For> won't recreate the child
				result.push(cached);
			} else {
				cache.set(panel.id, panel);
				result.push(panel);
			}
		}

		// Clean up removed panels
		for (const id of cache.keys()) {
			if (!seen.has(id)) cache.delete(id);
		}

		return result;
	});
}

export const GroupRenderer: Component<GroupRendererProps> = (props) => {
	const $focused = () => workspace({ focused: props.focusedGroupId === props.node.id });
	const activePanelId = () => props.node.activePanel || props.node.panels[0]?.id;
	const stablePanels = useStablePanels(() => props.node.panels);

	return (
		<div class={$focused().group} onPointerDown={() => props.onGroupFocus(props.node.id)}>
			<div class={workspace().viewport}>
				<For each={stablePanels()}>
					{(panel) => (
						<div
							style={{
								position: "absolute",
								inset: "0",
								"pointer-events": panel.id === activePanelId() ? "auto" : "none",
							}}
						>
							{props.renderViewport(panel)}
						</div>
					)}
				</For>
			</div>
		</div>
	);
};
