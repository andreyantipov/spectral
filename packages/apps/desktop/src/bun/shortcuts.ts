import { type AppCommand, DEFAULT_SHORTCUTS, EventBus } from "@ctrl/core.port.event-bus";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";

/**
 * Dispatches a keyboard shortcut as an EventBus command.
 * Called from the Bun process when a shortcut is received via IPC.
 */
export function dispatchShortcut(
	runtime: ManagedRuntime.ManagedRuntime<EventBus, never>,
	key: string,
) {
	const binding = DEFAULT_SHORTCUTS.find(
		(s) => normalizeShortcut(s.shortcut) === normalizeShortcut(key),
	);
	if (!binding) return;

	const command: AppCommand = {
		type: "command",
		action: binding.action,
		meta: { source: "keyboard" },
	};

	void runtime.runPromise(EventBus.pipe(Effect.flatMap((bus) => bus.send(command))));
}

/** Normalize shortcut strings for comparison: "Cmd+K" -> "cmd+k" */
function normalizeShortcut(s: string): string {
	return s.toLowerCase().replace("commandorcontrol", "cmd");
}
