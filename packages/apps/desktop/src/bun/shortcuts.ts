import { type AppCommand, EventBus } from "@ctrl/arch.contract.event-bus";
import { DEFAULT_SHORTCUTS } from "@ctrl/feature.system.settings";
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
		payload: binding.payload,
		meta: { source: "keyboard" },
	};

	void runtime.runPromise(EventBus.pipe(Effect.flatMap((bus) => bus.send(command))));
}

/** Normalize shortcut strings for comparison: "Cmd+K" -> "cmd+k" */
function normalizeShortcut(s: string): string {
	return s.toLowerCase().replace("commandorcontrol", "cmd");
}
