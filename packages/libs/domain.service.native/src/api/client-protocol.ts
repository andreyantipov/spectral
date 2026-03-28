/**
 * RpcClient.Protocol implementation that tunnels @effect/rpc over
 * Electrobun's IPC message channel. Runs on the webview side.
 *
 * This module is GENERIC — it has no knowledge of sessions, browsing,
 * or any domain concept.
 */
import * as RpcClient from "@effect/rpc/RpcClient";
import type { FromClientEncoded, FromServerEncoded } from "@effect/rpc/RpcMessage";
import * as RpcSerialization from "@effect/rpc/RpcSerialization";
import * as Effect from "effect/Effect";
import * as Mailbox from "effect/Mailbox";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import type { ElectrobunRpcHandle } from "../model/electrobun-rpc.js";

const CHANNEL = "effect-rpc";

/**
 * Create an `RpcClient.Protocol` that communicates via an Electrobun IPC handle.
 *
 * The webview side sends serialised requests on `"effect-rpc"` and listens on
 * the same channel for responses from the Bun side.
 */
export const make = (
	handle: ElectrobunRpcHandle,
): Effect.Effect<
	RpcClient.Protocol["Type"],
	never,
	RpcSerialization.RpcSerialization | Scope.Scope
> =>
	RpcClient.Protocol.make(
		Effect.fnUntraced(function* (writeResponse) {
			const serialization = yield* RpcSerialization.RpcSerialization;
			const parser = serialization.unsafeMake();
			const inbox = yield* Mailbox.make<FromServerEncoded>();

			// Bridge Electrobun callback into the Effect world via a Mailbox
			handle.addMessageListener(CHANNEL, (raw) => {
				try {
					const decoded = parser.decode(raw as Uint8Array | string) as readonly FromServerEncoded[];
					for (const message of decoded) {
						inbox.unsafeOffer(message);
					}
				} catch {
					// drop malformed message — don't crash the process
				}
			});

			// Drain the inbox, forwarding each message to the RPC client
			yield* Mailbox.toStream(inbox).pipe(
				Stream.runForEach((message) => writeResponse(message)),
				Effect.forkScoped,
			);

			return {
				send(request: FromClientEncoded) {
					const encoded = parser.encode(request);
					if (encoded === undefined) return Effect.void;
					handle.send[CHANNEL](encoded);
					return Effect.void;
				},
				supportsAck: false,
				supportsTransferables: false,
			};
		}),
	);

/**
 * Convenience alias for the client-side Electrobun protocol.
 */
export { make as ElectrobunClientProtocol };
