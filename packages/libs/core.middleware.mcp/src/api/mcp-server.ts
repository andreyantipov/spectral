import { EventBus } from "@ctrl/core.contract.event-bus";
import type { ServerWebSocket } from "bun";
import { Effect, Layer, Stream } from "effect";

const DEV_SERVER_PORT = 50100;

type WsMessage = { type: "send"; action: string; payload?: unknown };

export const McpServerLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;
		const clients = new Set<ServerWebSocket<unknown>>();

		// Forward all EventBus events to connected WS clients
		yield* Effect.forkScoped(
			Stream.runForEach(bus.events, (event) =>
				Effect.sync(() => {
					const msg = JSON.stringify(event);
					for (const ws of clients) ws.send(msg);
				}),
			),
		);

		const server = Bun.serve({
			port: DEV_SERVER_PORT,
			fetch(req, server) {
				if (server.upgrade(req)) return;
				return new Response("WebSocket only", { status: 426 });
			},
			websocket: {
				open(ws) {
					clients.add(ws);
				},
				close(ws) {
					clients.delete(ws);
				},
				message(ws, raw) {
					try {
						const msg = JSON.parse(String(raw)) as WsMessage;
						if (msg.type === "send") {
							Effect.runPromise(
								bus.send({
									type: "command",
									action: msg.action,
									payload: msg.payload ?? {},
									meta: { source: "agent" },
								}),
							);
						}
					} catch {
						ws.send(JSON.stringify({ type: "error", message: "invalid message" }));
					}
				},
			},
		});

		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				server.stop();
			}),
		);
	}),
);
