import type { AppCommand } from "@ctrl/core.port.event-bus";
import { EventBus } from "@ctrl/core.port.event-bus";
import { Effect, type ManagedRuntime } from "effect";
import { useRuntime } from "./use-runtime";

export function useApi() {
	const runtime = useRuntime() as unknown as ManagedRuntime.ManagedRuntime<EventBus, never>;

	const send = (action: string, payload?: unknown) => {
		const cmd: AppCommand = {
			type: "command",
			action,
			payload,
			meta: { source: "ui" },
		};
		return runtime.runPromise(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				yield* bus.send(cmd);
			}),
		);
	};

	return {
		session: {
			create: (payload: { readonly mode: "visual" }) => send("session.create", payload),
			close: (payload: { readonly id: string }) => send("session.close", payload),
			activate: (payload: { readonly id: string }) => send("session.activate", payload),
		},
		nav: {
			navigate: (payload: { readonly id: string; readonly input: string }) =>
				send("nav.navigate", payload),
			back: (payload: { readonly id: string }) => send("nav.back", payload),
			forward: (payload: { readonly id: string }) => send("nav.forward", payload),
			report: (payload: { readonly id: string; readonly url: string }) =>
				send("nav.report", payload),
			updateTitle: (payload: { readonly id: string; readonly title: string }) =>
				send("nav.update-title", payload),
		},
		bm: {
			add: (payload: { readonly url: string; readonly title: string | null }) =>
				send("bm.add", payload),
			remove: (payload: { readonly id: string }) => send("bm.remove", payload),
		},
	};
}
