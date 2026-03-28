import { NavigationEvents } from "./groups/navigation";
import { SessionEvents } from "./groups/session";
import { UIEvents } from "./groups/ui";
import { WorkspaceEvents } from "./groups/workspace";

export type ShortcutBinding = {
	readonly action: string;
	readonly shortcut: string;
	readonly label: string;
	readonly when?: string;
	/** Extra payload merged into the command (e.g. direction for split) */
	readonly payload?: Record<string, unknown>;
};

export const DEFAULT_SHORTCUTS: readonly ShortcutBinding[] = [
	{ action: SessionEvents.events["session.create"].tag, shortcut: "Cmd+T", label: "New Tab" },
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
