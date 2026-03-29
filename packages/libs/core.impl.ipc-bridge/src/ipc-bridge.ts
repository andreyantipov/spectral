import { EventBus } from "@ctrl/core.contract.event-bus";
import { Effect, Layer, Schema, Stream } from "effect";
import type { ElectrobunIpcHandle } from "./ipc-handle";
import { AppCommandSchema, AppEventSchema } from "./ipc-schema";

const CMD_CHANNEL = "event-bus:cmd";
const EVT_CHANNEL = "event-bus:evt";

/**
 * IPC bridge -- one Layer, configured per side.
 *
 * - `"main"`: receives commands from IPC -> `bus.send`, forwards `bus.events` -> IPC
 * - `"webview"`: receives events from IPC -> `bus.publish`, forwards `bus.commands` -> IPC
 *
 * Both sides require a local `EventBusLive` in the layer stack.
 */
export const IpcBridgeLive = (handle: ElectrobunIpcHandle, role: "main" | "webview") =>
	Layer.scopedDiscard(
		Effect.gen(function* () {
			const bus = yield* EventBus;

			if (role === "main") {
				// Receive commands from webview
				handle.addMessageListener(CMD_CHANNEL, (raw) => {
					try {
						const command = Schema.decodeUnknownSync(AppCommandSchema)(raw);
						Effect.runFork(bus.send(command));
					} catch (e) {
						console.error("[IpcBridge] Failed to decode command:", e);
					}
				});

				// Forward events to webview
				yield* bus.events.pipe(
					Stream.runForEach((event) =>
						Effect.sync(() => {
							const encoded = Schema.encodeSync(AppEventSchema)(event);
							handle.send[EVT_CHANNEL](encoded);
						}),
					),
					Effect.forkScoped,
				);
			} else {
				// Receive events from main process
				handle.addMessageListener(EVT_CHANNEL, (raw) => {
					try {
						const event = Schema.decodeUnknownSync(AppEventSchema)(raw);
						Effect.runFork(bus.publish(event));
					} catch (e) {
						console.error("[IpcBridge] Failed to decode event:", e);
					}
				});

				// Forward commands to main process
				yield* bus.commands.pipe(
					Stream.runForEach((command) =>
						Effect.sync(() => {
							const encoded = Schema.encodeSync(AppCommandSchema)(command);
							handle.send[CMD_CHANNEL](encoded);
						}),
					),
					Effect.forkScoped,
				);
			}
		}),
	);
