import {
	NAV_BACK,
	NAV_FORWARD,
	SESSION_ACTIVATE,
	SESSION_CLOSE,
	SESSION_CREATE,
	UI_TOGGLE_OMNIBOX,
	WS_SPLIT_DOWN,
	WS_SPLIT_RIGHT,
} from "./actions";

export type ShortcutBinding = {
	readonly action: string;
	readonly shortcut: string;
	readonly label: string;
	readonly when?: string;
};

export const DEFAULT_SHORTCUTS: readonly ShortcutBinding[] = [
	{ action: SESSION_CREATE, shortcut: "Cmd+T", label: "New Tab" },
	{ action: SESSION_CLOSE, shortcut: "Cmd+W", label: "Close Tab" },
	{ action: NAV_BACK, shortcut: "Cmd+[", label: "Back" },
	{ action: NAV_FORWARD, shortcut: "Cmd+]", label: "Forward" },
	{ action: WS_SPLIT_RIGHT, shortcut: "Cmd+D", label: "Split Right" },
	{ action: WS_SPLIT_DOWN, shortcut: "Cmd+Shift+D", label: "Split Down" },
	{ action: UI_TOGGLE_OMNIBOX, shortcut: "Cmd+K", label: "Command Palette" },
	...Array.from({ length: 9 }, (_, i) => ({
		action: SESSION_ACTIVATE,
		shortcut: `Cmd+${i + 1}`,
		label: `Switch to Tab ${i + 1}`,
	})),
];
