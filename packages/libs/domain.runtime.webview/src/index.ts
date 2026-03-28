import type { ElectrobunRpcHandle } from "@ctrl/domain.adapter.rpc";
import { ElectrobunClientProtocol } from "@ctrl/domain.adapter.rpc";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Layer } from "effect";

/**
 * Build the webview-side Effect layer stack.
 *
 * Compose: ElectrobunClientProtocol -> RpcSerialization -> RpcClient.Protocol
 *
 * Consumers obtain a typed RPC client from the runtime context — no domain
 * imports needed here.
 */
export const createWebviewLive = (electrobunRpc: ElectrobunRpcHandle) => {
	const SerializationLive = RpcSerialization.layerJson;

	const ClientProtocolLive = Layer.scoped(
		RpcClient.Protocol,
		ElectrobunClientProtocol(electrobunRpc),
	).pipe(Layer.provide(SerializationLive));

	return ClientProtocolLive;
};
