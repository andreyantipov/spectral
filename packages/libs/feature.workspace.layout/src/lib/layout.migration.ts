import type { GroupNode, PanelRef } from "../model/layout.validators";
import { makeGroupNode } from "./tree-ops";

export const bootstrapDefaultLayout = (activeSessionId?: string): GroupNode => {
	if (!activeSessionId) {
		return makeGroupNode([], "");
	}
	const panel: PanelRef = {
		id: `panel-${activeSessionId}`,
		type: "session",
		entityId: activeSessionId,
		title: "New Tab",
		icon: null,
	};
	return makeGroupNode([panel], panel.id);
};
