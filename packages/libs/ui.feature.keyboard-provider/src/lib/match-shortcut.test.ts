import type { ShortcutBinding } from "@ctrl/base.schema";
import { describe, expect, it } from "vitest";
import { matchShortcut } from "./match-shortcut";

const bindings: ShortcutBinding[] = [
	{ action: "session.create", shortcut: "Cmd+T", label: "New Tab" },
	{ action: "session.close", shortcut: "Cmd+W", label: "Close Tab" },
	{
		action: "ws.split-panel",
		shortcut: "Cmd+D",
		label: "Split Right",
		payload: { direction: "horizontal" },
	},
];

describe("matchShortcut", () => {
	it("matches Cmd+T", () => {
		const event = {
			key: "t",
			metaKey: true,
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
		} as KeyboardEvent;
		expect(matchShortcut(event, bindings)?.action).toBe("session.create");
	});

	it("returns undefined for unmatched key", () => {
		const event = {
			key: "z",
			metaKey: true,
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
		} as KeyboardEvent;
		expect(matchShortcut(event, bindings)).toBeUndefined();
	});

	it("includes payload from binding", () => {
		const event = {
			key: "d",
			metaKey: true,
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
		} as KeyboardEvent;
		const match = matchShortcut(event, bindings);
		expect(match?.payload).toEqual({ direction: "horizontal" });
	});
});
