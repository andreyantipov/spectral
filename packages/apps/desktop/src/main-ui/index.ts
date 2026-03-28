import { initGlobalWebTracer, OTEL_SERVICE_NAMES } from "@ctrl/domain.adapter.otel/web";
import {
	createIpcBridge,
	type ElectrobunHandle,
	type ElectrobunRpcHandle,
} from "@ctrl/domain.service.native";
import { ManagedRuntime } from "effect";
import { createDesktopWebviewLive } from "./layers";
import { mount } from "./mount";

initApp();

async function initApp() {
	// Wait for electrobun globals to be injected by the native layer
	await waitForGlobal("__electrobun", 2000);

	// Register global OTEL provider for imperative UI tracing (withWebTracing)
	initGlobalWebTracer(OTEL_SERVICE_NAMES.webview);

	const { Electroview } = await import("electrobun/view");
	const { defineRPC } = await import("./rpc-view");

	const rpc = defineRPC(Electroview);
	new Electroview({ rpc });

	// Build the webview Effect layer with the Electrobun RPC handle.
	// The Electrobun RPC handle is structurally compatible with ElectrobunRpcHandle
	// but the Electrobun types are opaque, so we cast.
	const WebviewLive = createDesktopWebviewLive(rpc as unknown as ElectrobunRpcHandle);
	const runtime = ManagedRuntime.make(WebviewLive);

	// Ensure the runtime (and RPC client protocol) is initialized before rendering
	await runtime.runtime();

	// Create IPC bridge for app commands (same handle as effect-rpc)
	const ipcBridge = createIpcBridge(rpc as unknown as ElectrobunHandle);

	mount(runtime, ipcBridge);
}

function waitForGlobal(name: string, timeout: number): Promise<void> {
	return new Promise((resolve) => {
		if ((window as unknown as Record<string, unknown>)[name]) {
			resolve();
			return;
		}
		const start = Date.now();
		const check = () => {
			if ((window as unknown as Record<string, unknown>)[name] || Date.now() - start > timeout) {
				resolve();
				return;
			}
			requestAnimationFrame(check);
		};
		requestAnimationFrame(check);
	});
}
