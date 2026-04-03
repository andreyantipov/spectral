import type { GroupNode, PanelRef } from "@ctrl/base.schema";
import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
import type { WorkspaceCommand } from "./types";
import { workspace } from "./workspace.style";

export type GroupRendererProps = {
	node: GroupNode;
	focusedGroupId: string | null;
	renderViewport: (panel: PanelRef) => JSX.Element;
	onCommand: (cmd: WorkspaceCommand) => void;
	onGroupFocus: (groupId: string) => void;
};

export const GroupRenderer: Component<GroupRendererProps> = (props) => {
	const $focused = () => workspace({ focused: props.focusedGroupId === props.node.id });
	const activePanel = () =>
		props.node.panels.find((p) => p.id === props.node.activePanel) ?? props.node.panels[0];

	return (
		<div class={$focused().group} onPointerDown={() => props.onGroupFocus(props.node.id)}>
			<div class={workspace().viewport}>
				<Show when={activePanel()}>{(panel) => props.renderViewport(panel())}</Show>
			</div>
		</div>
	);
};
