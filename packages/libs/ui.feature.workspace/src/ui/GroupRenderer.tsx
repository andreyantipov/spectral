import type { GroupNode, PanelRef } from "@ctrl/base.schema";
import type { Component, JSX } from "solid-js";
import { For, Show } from "solid-js";
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
			<Show when={props.node.panels.length > 1}>
				<div class={workspace().tabBar}>
					<For each={props.node.panels}>
						{(panel) => {
							const $tab = () => workspace({ active: panel.id === props.node.activePanel });
							return (
								<div
									class={$tab().tab}
									role="tab"
									tabIndex={0}
									onClick={() =>
										props.onCommand({
											type: "activate-panel",
											panelId: panel.id,
										})
									}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											props.onCommand({
												type: "activate-panel",
												panelId: panel.id,
											});
										}
									}}
								>
									<Show when={panel.icon}>
										{(icon) => (
											<img
												src={icon()}
												alt=""
												width={14}
												height={14}
												style={{
													"border-radius": "2px",
													"flex-shrink": "0",
												}}
												onError={(e) => {
													(e.currentTarget as HTMLImageElement).style.display = "none";
												}}
											/>
										)}
									</Show>
									<span
										style={{
											overflow: "hidden",
											"text-overflow": "ellipsis",
											"white-space": "nowrap",
											flex: "1",
										}}
									>
										{panel.title}
									</span>
									<button
										type="button"
										class={$tab().tabClose}
										onClick={(e) => {
											e.stopPropagation();
											props.onCommand({
												type: "close-panel",
												panelId: panel.id,
											});
										}}
									>
										×
									</button>
								</div>
							);
						}}
					</For>
				</div>
			</Show>
			<div class={workspace().viewport}>
				<Show when={activePanel()}>{(panel) => props.renderViewport(panel())}</Show>
			</div>
		</div>
	);
};
