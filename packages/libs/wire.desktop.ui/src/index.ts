import { EventBusLive } from "@ctrl/core.impl.event-bus";
import { type ElectrobunIpcHandle, IpcBridgeLive } from "@ctrl/core.impl.ipc-bridge";
import { initGlobalWebTracer, OTEL_SERVICE_NAMES, OtelLive } from "@ctrl/core.middleware.otel/web";
import { Layer } from "effect";

export type { ElectrobunIpcHandle };
export { initGlobalWebTracer, OTEL_SERVICE_NAMES };

/**
 * Create the webview-side Effect layer stack.
 *
 * Provides EventBus (local PubSub) + IPC bridge to sync with main process.
 * Commands sent from the webview are forwarded to the main process,
 * and events from the main process are received and published locally.
 * Includes OTEL instrumentation for the webview process.
 */
export const createUiProcess = (handle: ElectrobunIpcHandle) => {
	const BusLayer = EventBusLive;
	return Layer.mergeAll(
		BusLayer,
		IpcBridgeLive(handle, "webview").pipe(Layer.provide(BusLayer)),
	).pipe(Layer.provide(OtelLive(OTEL_SERVICE_NAMES.webview)));
};
