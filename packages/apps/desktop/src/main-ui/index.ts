import { mount } from "./mount";

// Mount UI immediately — don't let RPC init failure block rendering
const rpcPromise = initElectrobun();
mount(rpcPromise);

async function initElectrobun() {
	// Wait for electrobun globals to be injected by the native layer
	await waitForGlobal("__electrobun", 2000);

	const { Electroview } = await import("electrobun/view");
	const { defineRPC } = await import("./rpc-view");

	const rpc = defineRPC(Electroview);
	new Electroview({ rpc });
	return rpc;
}

function waitForGlobal(name: string, timeout: number): Promise<void> {
	return new Promise((resolve) => {
		if ((window as Record<string, unknown>)[name]) {
			resolve();
			return;
		}
		const start = Date.now();
		const check = () => {
			if ((window as Record<string, unknown>)[name] || Date.now() - start > timeout) {
				resolve();
				return;
			}
			requestAnimationFrame(check);
		};
		requestAnimationFrame(check);
	});
}
