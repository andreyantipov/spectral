import { type AppCommand, EventBusRpcs } from "@ctrl/core.port.event-bus";
import { RpcClient } from "@effect/rpc";
import type { Protocol } from "@effect/rpc/RpcClient";
import { Effect, Exit, type ManagedRuntime, Scope } from "effect";
import { onCleanup } from "solid-js";
import { useRuntime } from "./use-runtime";

export function useEventBus() {
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

	return { send, client };
}
