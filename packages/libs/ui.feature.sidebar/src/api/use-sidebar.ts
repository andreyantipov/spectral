import { useRuntime, useStream } from "@ctrl/core.ui";
import type { BrowsingState } from "@ctrl/domain.service.browsing";
import { BrowsingRpcs } from "@ctrl/domain.service.browsing";
import { RpcClient } from "@effect/rpc";
import type { Protocol } from "@effect/rpc/RpcClient";
import { Effect, Exit, type ManagedRuntime, Scope, Stream } from "effect";
import { onCleanup } from "solid-js";

export function useBrowsingRpc(): {
	client: RpcClient.FromGroup<typeof BrowsingRpcs>;
	state: () => BrowsingState | undefined;
} {
	// useRuntime() returns an untyped ManagedRuntime — cast to the webview layer
	// shape so runSync can accept an Effect that requires Protocol and Scope.
	const runtime = useRuntime() as unknown as ManagedRuntime.ManagedRuntime<
		Protocol | Scope.Scope,
		never
	>;

	// Create a scope tied to the component lifecycle so the RPC client's
	// resources are not finalized prematurely.
	const scope = runtime.runSync(Scope.make());
	onCleanup(() => runtime.runSync(Scope.close(scope, Exit.void)));

	// RpcClient.make requires Protocol (from the RPC layer) and Scope.
	// We provide the long-lived scope instead of using Effect.scoped, which
	// would close the scope immediately after runSync returns.
	const client = runtime.runSync(
		RpcClient.make(BrowsingRpcs).pipe(Effect.provideService(Scope.Scope, scope)),
	) as RpcClient.FromGroup<typeof BrowsingRpcs>;

	const browsingStream = client.browsingChanges().pipe(Stream.catchAll(() => Stream.empty));

	const state = useStream<BrowsingState | undefined>(browsingStream, undefined);

	return { client, state };
}
