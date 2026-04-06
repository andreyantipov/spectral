import type { ShortcutBinding } from "@ctrl/base.schema";
import {
	NavigationEvents,
	SessionEvents,
	UIEvents,
	WorkspaceEvents,
} from "@ctrl/arch.contract.event-bus";

export const DEFAULT_SHORTCUTS: readonly ShortcutBinding[] = [
	{
		action: SessionEvents.events["session.create"].tag,
		shortcut: "Cmd+T",
		label: "New Tab",
		payload: { mode: "visual" },
	},
	{ action: SessionEvents.events["session.close"].tag, shortcut: "Cmd+W", label: "Close Tab" },
	{ action: NavigationEvents.events["nav.back"].tag, shortcut: "Cmd+[", label: "Back" },
	{ action: NavigationEvents.events["nav.forward"].tag, shortcut: "Cmd+]", label: "Forward" },
	{
		action: WorkspaceEvents.events["ws.split-panel"].tag,
		shortcut: "Cmd+D",
		label: "Split Right",
		payload: { direction: "horizontal" },
	},
	{
		action: WorkspaceEvents.events["ws.split-panel"].tag,
		shortcut: "Cmd+Shift+D",
		label: "Split Down",
		payload: { direction: "vertical" },
	},
	{ action: UIEvents.events["ui.toggle-omnibox"].tag, shortcut: "Cmd+K", label: "Command Palette" },
	...Array.from({ length: 9 }, (_, i) => ({
		action: SessionEvents.events["session.activate"].tag,
		shortcut: `Cmd+${i + 1}`,
		label: `Switch to Tab ${i + 1}`,
	})),
];
