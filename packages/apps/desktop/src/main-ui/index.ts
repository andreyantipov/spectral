import type { ElectrobunRpcHandle } from "@ctrl/domain.adapter.rpc";
import { ManagedRuntime } from "effect";
import { createWebviewLive } from "./layers";
import { mount } from "./mount";

initApp();

async function initApp() {
	// Wait for electrobun globals to be injected by the native layer
	await waitForGlobal("__electrobun", 2000);

	const { Electroview } = await import("electrobun/view");
	const { defineRPC } = await import("./rpc-view");

	const rpc = defineRPC(Electroview);
	new Electroview({ rpc });

	// Expose RPC send for UI components that need to message the Bun process
	// (e.g., hide/show BrowserView when CommandCenter opens)
	(window as unknown as Record<string, unknown>).__ctrlpage = {
		sendToBun: (channel: string, data: unknown) => {
			const sender = (rpc as unknown as Record<string, Record<string, (data: unknown) => void>>)
				.send;
			sender?.[channel]?.(data);
		},
	};

	// Build the webview Effect layer with the Electrobun RPC handle.
	// The Electrobun RPC handle is structurally compatible with ElectrobunRpcHandle
	// but the Electrobun types are opaque, so we cast.
	const WebviewLive = createWebviewLive(rpc as unknown as ElectrobunRpcHandle);
	const runtime = ManagedRuntime.make(WebviewLive);

	// Ensure the runtime (and RPC client protocol) is initialized before rendering
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
