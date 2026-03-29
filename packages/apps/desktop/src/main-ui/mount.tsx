import type { AppCommand } from "@ctrl/domain.adapter.carrier";
import type { ManagedRuntime } from "effect";
import { render } from "solid-js/web";
import App from "./App";

export type IpcBridgeHandle = {
	readonly send: (command: AppCommand) => void;
	readonly subscribe: (handler: (command: AppCommand) => void) => () => void;
};

export function mount(
	runtime: ManagedRuntime.ManagedRuntime<never, never>,
	bridge: IpcBridgeHandle,
) {
	const root = document.getElementById("root");
	if (root) {
		render(() => <App runtime={runtime} bridge={bridge} />, root);
	}
}
