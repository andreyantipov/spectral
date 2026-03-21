import { OTEL_SERVICE_NAMES, OtelWebLive } from "@ctrl/domain.adapter.otel/web";
import type { ElectrobunRpcHandle } from "@ctrl/domain.adapter.rpc";
import { ElectrobunClientProtocol } from "@ctrl/domain.adapter.rpc";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Layer } from "effect";

/**
 * Build the webview-side Effect layer stack.
 *
 * Compose: ElectrobunClientProtocol -> RpcSerialization -> RpcClient.Protocol
 *          + OtelWebLive for browser-side tracing
 *
 * Consumers obtain a typed client via `RpcClient.make(BrowsingRpcs)` from the
 * runtime context — no domain imports needed here.
 */
export const createWebviewLive = (electrobunRpc: ElectrobunRpcHandle) => {
	const SerializationLive = RpcSerialization.layerJson;

	const ClientProtocolLive = Layer.scoped(
		RpcClient.Protocol,
		ElectrobunClientProtocol(electrobunRpc),
	).pipe(Layer.provide(SerializationLive));

	return ClientProtocolLive.pipe(Layer.provide(OtelWebLive(OTEL_SERVICE_NAMES.webview)));
};
