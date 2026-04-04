import type { LayoutNode, PanelRef } from "@ctrl/base.schema";
import type { JSX } from "solid-js";

export type WorkspaceCommand =
	| { type: "resize"; splitId: string; sizes: number[] }
	| { type: "activate-panel"; panelId: string }
	| { type: "close-panel"; panelId: string }
	| { type: "reorder-panel"; groupId: string; panelId: string; index: number };

export type WorkspaceProps = {
	layout: LayoutNode;
	focusedGroupId: string | null;
	renderViewport: (panel: PanelRef) => JSX.Element;
	onCommand: (cmd: WorkspaceCommand) => void;
	onGroupFocus: (groupId: string) => void;
};
