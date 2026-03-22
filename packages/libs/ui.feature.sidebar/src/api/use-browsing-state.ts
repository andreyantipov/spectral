import { useRuntime, useStream } from "@ctrl/core.ui";
import type { BrowsingState } from "@ctrl/domain.service.browsing";
import { BrowsingRpcs } from "@ctrl/domain.service.browsing";
import { RpcClient } from "@effect/rpc";
import type { Protocol } from "@effect/rpc/RpcClient";
import { Effect, Exit, type ManagedRuntime, Scope, Stream } from "effect";
import { onCleanup } from "solid-js";

export function useBrowsingState() {
	const runtime = useRuntime() as unknown as ManagedRuntime.ManagedRuntime<
		Protocol | Scope.Scope,
		never
	>;

	const scope = runtime.runSync(Scope.make());
	onCleanup(() => runtime.runSync(Scope.close(scope, Exit.void)));

	const client = runtime.runSync(
		RpcClient.make(BrowsingRpcs).pipe(Effect.provideService(Scope.Scope, scope)),
	) as RpcClient.FromGroup<typeof BrowsingRpcs>;

	const stream = client.browsingChanges().pipe(Stream.catchAll(() => Stream.empty));
	return useStream<BrowsingState | undefined>(stream, undefined);
}
