import { type AppCommand, EventBus, EventBusLive } from "@ctrl/core.ports.event-bus";
import { Effect, ManagedRuntime } from "effect";

// Singleton EventBus runtime for the webview process
let busRuntime: ManagedRuntime.ManagedRuntime<EventBus, never> | undefined;

function getBusRuntime() {
	if (!busRuntime) {
		busRuntime = ManagedRuntime.make(EventBusLive);
	}
	return busRuntime;
}

export function useEventBus() {
	const rt = getBusRuntime();

	const send = (action: string, payload?: unknown) => {
		const cmd: AppCommand = {
			type: "command",
			action,
			payload,
			meta: { source: "ui" },
		};
		void rt.runPromise(EventBus.pipe(Effect.flatMap((bus) => bus.send(cmd))));
	};

	return { send };
}
