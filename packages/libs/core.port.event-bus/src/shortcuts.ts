import { NavigationSignals } from "./signals/navigation";
import { SessionSignals } from "./signals/session";
import { UISignals } from "./signals/ui";
import { WorkspaceSignals } from "./signals/workspace";

export type ShortcutBinding = {
	readonly action: string;
	readonly shortcut: string;
	readonly label: string;
	readonly when?: string;
};

export const DEFAULT_SHORTCUTS: readonly ShortcutBinding[] = [
	{ action: SessionSignals.commands.create.name, shortcut: "Cmd+T", label: "New Tab" },
	{ action: SessionSignals.commands.close.name, shortcut: "Cmd+W", label: "Close Tab" },
	{ action: NavigationSignals.commands.back.name, shortcut: "Cmd+[", label: "Back" },
	{ action: NavigationSignals.commands.forward.name, shortcut: "Cmd+]", label: "Forward" },
	{ action: WorkspaceSignals.commands.splitRight.name, shortcut: "Cmd+D", label: "Split Right" },
	{
		action: WorkspaceSignals.commands.splitDown.name,
		shortcut: "Cmd+Shift+D",
		label: "Split Down",
	},
	{ action: UISignals.commands.toggleOmnibox.name, shortcut: "Cmd+K", label: "Command Palette" },
	...Array.from({ length: 9 }, (_, i) => ({
		action: SessionSignals.commands.activate.name,
		shortcut: `Cmd+${i + 1}`,
		label: `Switch to Tab ${i + 1}`,
	})),
];
