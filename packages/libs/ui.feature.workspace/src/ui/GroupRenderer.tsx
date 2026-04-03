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
								position: "absolute",
								inset: "0",
								visibility: panel.id === activePanelId() ? "visible" : "hidden",
								"z-index": panel.id === activePanelId() ? "1" : "0",
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
