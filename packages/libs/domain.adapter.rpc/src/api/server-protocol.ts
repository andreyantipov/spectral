/**
 * RpcServer.Protocol implementation that tunnels @effect/rpc over
 * Electrobun's IPC message channel. Runs on the Bun (main process) side.
 *
 * This module is GENERIC — it has no knowledge of sessions, browsing,
 * or any domain concept.
 */
import type { FromClientEncoded, FromServerEncoded } from "@effect/rpc/RpcMessage";
import * as RpcSerialization from "@effect/rpc/RpcSerialization";
import * as RpcServer from "@effect/rpc/RpcServer";
import * as Effect from "effect/Effect";
import * as Mailbox from "effect/Mailbox";
import * as Option from "effect/Option";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import type { ElectrobunRpcHandle } from "../model/electrobun-rpc.js";

const CHANNEL = "effect-rpc";

/**
 * Create an `RpcServer.Protocol` that communicates via an Electrobun IPC handle.
 *
 * Single-client model: Electrobun IPC is always 1-to-1 (main <-> webview),
 * so we hardcode `clientId = 0`.
 */
export const make = (
	handle: ElectrobunRpcHandle,
): Effect.Effect<
	RpcServer.Protocol["Type"],
	never,
	RpcSerialization.RpcSerialization | Scope.Scope
> =>
	RpcServer.Protocol.make(
		Effect.fnUntraced(function* (writeRequest) {
			const serialization = yield* RpcSerialization.RpcSerialization;
			const parser = serialization.unsafeMake();
			const disconnects = yield* Mailbox.make<number>();
			const inbox = yield* Mailbox.make<FromClientEncoded>();

			// Bridge Electrobun callback into the Effect world via a Mailbox
			handle.addMessageListener(CHANNEL, (raw) => {
				try {
					const decoded = parser.decode(raw as Uint8Array | string) as readonly FromClientEncoded[];
					for (const message of decoded) {
						inbox.unsafeOffer(message);
					}
				} catch {
					// drop malformed message — don't crash the process
				}
			});

			// Drain the inbox, forwarding each message to the RPC server
			yield* Mailbox.toStream(inbox).pipe(
				Stream.runForEach((message) => writeRequest(0, message)),
				Effect.forkScoped,
			);

			return {
				disconnects,
				send(_clientId: number, response: FromServerEncoded) {
					const encoded = parser.encode(response);
					if (encoded === undefined) return Effect.void;
					handle.send[CHANNEL](encoded);
					return Effect.void;
				},
				end(_clientId: number) {
					return Effect.void;
				},
				clientIds: Effect.succeed(new Set([0])),
				initialMessage: Effect.succeed(Option.none()),
				supportsAck: false,
				supportsTransferables: false,
				supportsSpanPropagation: false,
			};
		}),
	);

/**
 * Convenience alias for the server-side Electrobun protocol.
 */
export { make as ElectrobunServerProtocol };
