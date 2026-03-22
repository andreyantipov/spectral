export type ShortcutBinding = {
	readonly action: string;
	readonly shortcut: string;
	readonly label: string;
	readonly when?: string;
};

export const DEFAULT_SHORTCUTS: readonly ShortcutBinding[] = [
	{ action: "session.create", shortcut: "Cmd+T", label: "New Tab" },
	{ action: "session.close", shortcut: "Cmd+W", label: "Close Tab" },
	{ action: "nav.back", shortcut: "Cmd+[", label: "Back" },
	{ action: "nav.forward", shortcut: "Cmd+]", label: "Forward" },
	{ action: "ws.split-right", shortcut: "Cmd+D", label: "Split Right" },
	{
		action: "ws.split-down",
		shortcut: "Cmd+Shift+D",
		label: "Split Down",
	},
	{ action: "ui.toggle-omnibox", shortcut: "Cmd+K", label: "Command Palette" },
	...Array.from({ length: 9 }, (_, i) => ({
		action: "session.activate",
		shortcut: `Cmd+${i + 1}`,
		label: `Switch to Tab ${i + 1}`,
	})),
];
