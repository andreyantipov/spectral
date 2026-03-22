import type { GroupNode, PanelRef } from "../model/layout.validators";

export const bootstrapDefaultLayout = (activeSessionId?: string): GroupNode => {
	if (!activeSessionId) {
		return { type: "group", panels: [], activePanel: "" };
	}
	const panel: PanelRef = {
		id: `panel-${activeSessionId}`,
		type: "session",
		sessionId: activeSessionId,
	};
	return { type: "group", panels: [panel], activePanel: panel.id };
};
