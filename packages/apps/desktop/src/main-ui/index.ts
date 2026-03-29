import {
	type ElectrobunIpcHandle,
	initGlobalWebTracer,
	OTEL_SERVICE_NAMES,
} from "@ctrl/wire.desktop.ui";
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
	// The Electrobun RPC handle is structurally compatible with ElectrobunIpcHandle.
	const WebviewLive = createDesktopWebviewLive(rpc as unknown as ElectrobunIpcHandle);
	const runtime = ManagedRuntime.make(WebviewLive);

	// Ensure the runtime (and EventBus IPC bridge) is initialized before rendering
	await runtime.runtime();

	mount(runtime);
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
