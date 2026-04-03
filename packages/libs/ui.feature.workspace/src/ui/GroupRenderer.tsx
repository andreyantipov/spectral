import type { GroupNode, PanelRef } from "@ctrl/base.schema";
import type { Component, JSX } from "solid-js";
import { For } from "solid-js";
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
	const activePanelId = () => props.node.activePanel || props.node.panels[0]?.id;

	return (
		<div class={$focused().group} onPointerDown={() => props.onGroupFocus(props.node.id)}>
			<div class={workspace().viewport}>
				<For each={props.node.panels}>
					{(panel) => (
						<div
							style={{
								width: "100%",
								height: "100%",
								display: panel.id === activePanelId() ? "block" : "none",
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
