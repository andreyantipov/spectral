import { type AppCommand, EventBusRpcs } from "@ctrl/core.port.event-bus";
import { RpcClient } from "@effect/rpc";
import type { Protocol } from "@effect/rpc/RpcClient";
import { Effect, Exit, type ManagedRuntime, Scope } from "effect";
import { onCleanup } from "solid-js";
import { useRuntime } from "./use-runtime";

export function useApi() {
	const runtime = useRuntime() as unknown as ManagedRuntime.ManagedRuntime<
		Protocol | Scope.Scope,
		never
	>;

	const scope = runtime.runSync(Scope.make());
	onCleanup(() => runtime.runSync(Scope.close(scope, Exit.void)));

	const client = runtime.runSync(
		RpcClient.make(EventBusRpcs).pipe(Effect.provideService(Scope.Scope, scope)),
	) as RpcClient.FromGroup<typeof EventBusRpcs>;

	const send = (action: string, payload?: unknown) => {
		const cmd: AppCommand = {
			type: "command",
			action,
			payload,
			meta: { source: "ui" },
		};
		void runtime.runPromise(client.dispatch({ command: cmd }));
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
