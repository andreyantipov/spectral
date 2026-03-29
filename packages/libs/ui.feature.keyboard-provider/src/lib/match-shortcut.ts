import type { ShortcutBinding } from "@ctrl/base.schema";

const parseShortcut = (shortcut: string) => {
	const parts = shortcut.toLowerCase().split("+");
	return {
		meta: parts.includes("cmd") || parts.includes("meta"),
		ctrl: parts.includes("ctrl"),
		shift: parts.includes("shift"),
		alt: parts.includes("alt") || parts.includes("opt"),
		key: parts[parts.length - 1],
	};
};

export const matchShortcut = (
	event: KeyboardEvent,
	bindings: readonly ShortcutBinding[],
): ShortcutBinding | undefined => {
	for (const binding of bindings) {
		const s = parseShortcut(binding.shortcut);
		if (
			event.key.toLowerCase() === s.key &&
			event.metaKey === s.meta &&
			event.ctrlKey === s.ctrl &&
			event.shiftKey === s.shift &&
			event.altKey === s.alt
		) {
			return binding;
		}
	}
	return undefined;
};
