import type { WorkspaceState } from "@ctrl/base.schema";
import { useApi } from "@ctrl/ui.base.api";
import { createSignal } from "solid-js";
import type { WorkspaceCommand } from "../ui/types";

export function useWorkspace() {
	const api = useApi();
	const workspaceState = api.on<WorkspaceState>("workspace.snapshot");

	const layout = () => workspaceState()?.root ?? null;

	const [focusedGroupId, setFocusedGroupId] = createSignal<string | null>(null);

	const handleCommand = (cmd: WorkspaceCommand) => {
		switch (cmd.type) {
			case "resize":
				api.dispatch("ws.resize", { splitId: cmd.splitId, sizes: cmd.sizes });
				break;
			case "activate-panel":
				api.dispatch("ws.activate-panel", { panelId: cmd.panelId });
				break;
			case "close-panel":
				api.dispatch("ws.close-panel", { panelId: cmd.panelId });
				break;
			case "reorder-panel":
				api.dispatch("ws.reorder-panel", {
					groupId: cmd.groupId,
					panelId: cmd.panelId,
					index: cmd.index,
				});
				break;
		}
	};

	return { layout, focusedGroupId, setFocusedGroupId, handleCommand };
}
