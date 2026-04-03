const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta", "CapsLock", "NumLock"]);

const SPECIAL_KEYS: Record<string, string> = {
	Enter: "\r",
	Backspace: "\x7f",
	Tab: "\t",
	Escape: "\x1b",
	ArrowUp: "\x1b[A",
	ArrowDown: "\x1b[B",
	ArrowRight: "\x1b[C",
	ArrowLeft: "\x1b[D",
	Home: "\x1b[H",
	End: "\x1b[F",
	Insert: "\x1b[2~",
	Delete: "\x1b[3~",
	PageUp: "\x1b[5~",
	PageDown: "\x1b[6~",
	F1: "\x1bOP",
	F2: "\x1bOQ",
	F3: "\x1bOR",
	F4: "\x1bOS",
	F5: "\x1b[15~",
	F6: "\x1b[17~",
	F7: "\x1b[18~",
	F8: "\x1b[19~",
	F9: "\x1b[20~",
	F10: "\x1b[21~",
	F11: "\x1b[23~",
	F12: "\x1b[24~",
};

export function encodeKey(e: KeyboardEvent): string | null {
	if (MODIFIER_KEYS.has(e.key)) return null;

	// Ctrl+letter → control character (ASCII 1-26)
	if (e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
		const code = e.key.toLowerCase().charCodeAt(0);
		if (code >= 97 && code <= 122) {
			return String.fromCharCode(code - 96);
		}
	}

	// Alt+key → ESC prefix
	if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
		return `\x1b${e.key}`;
	}

	// Special keys
	const special = SPECIAL_KEYS[e.key];
	if (special) return special;

	// Printable single character
	if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
		return e.key;
	}

	return null;
}
