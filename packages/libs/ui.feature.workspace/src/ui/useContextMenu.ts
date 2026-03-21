import { createSignal } from "solid-js";

export type ContextMenuAction =
	| { type: "splitRight"; panelId: string }
	| { type: "splitDown"; panelId: string }
	| { type: "closeTab"; panelId: string }
	| { type: "moveToGroup"; panelId: string };

export const useContextMenu = () => {
	const [position, setPosition] = createSignal<{ x: number; y: number } | null>(null);
	const [targetPanel, setTargetPanel] = createSignal<string | null>(null);

	const open = (e: MouseEvent, panelId: string) => {
		e.preventDefault();
		setPosition({ x: e.clientX, y: e.clientY });
		setTargetPanel(panelId);
	};

	const close = () => {
		setPosition(null);
		setTargetPanel(null);
	};

	return { position, targetPanel, open, close };
};
