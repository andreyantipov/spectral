import type { LayoutNode, PanelRef } from "@ctrl/base.schema";
import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
import { GroupRenderer } from "./GroupRenderer";
import { SplitRenderer } from "./SplitRenderer";
import type { WorkspaceCommand } from "./types";
import { workspace } from "./workspace.style";

export type LayoutRendererProps = {
	layout: LayoutNode;
	focusedGroupId: string | null;
	renderViewport: (panel: PanelRef) => JSX.Element;
	onCommand: (cmd: WorkspaceCommand) => void;
	onGroupFocus: (groupId: string) => void;
};

export const LayoutRenderer: Component<LayoutRendererProps> = (props) => {
	return (
		<Show
			when={props.layout.type === "split" ? props.layout : undefined}
			fallback={
				<Show when={props.layout.type === "group" ? props.layout : undefined}>
					{(group) => (
						<GroupRenderer
							node={group()}
							focusedGroupId={props.focusedGroupId}
							renderViewport={props.renderViewport}
							onCommand={props.onCommand}
							onGroupFocus={props.onGroupFocus}
						/>
					)}
				</Show>
			}
		>
			{(split) => (
				<SplitRenderer
					node={split()}
					focusedGroupId={props.focusedGroupId}
					renderViewport={props.renderViewport}
					onCommand={props.onCommand}
					onGroupFocus={props.onGroupFocus}
				/>
			)}
		</Show>
	);
};

export type LayoutRootProps = {
	layout: LayoutNode;
	focusedGroupId: string | null;
	renderViewport: (panel: PanelRef) => JSX.Element;
	onCommand: (cmd: WorkspaceCommand) => void;
	onGroupFocus: (groupId: string) => void;
};

/** Top-level workspace root with sva styling */
export const LayoutRoot: Component<LayoutRootProps> = (props) => {
	const $ = workspace();

	return (
		<div class={$.root}>
			<LayoutRenderer
				layout={props.layout}
				focusedGroupId={props.focusedGroupId}
				renderViewport={props.renderViewport}
				onCommand={props.onCommand}
				onGroupFocus={props.onGroupFocus}
			/>
		</div>
	);
};
