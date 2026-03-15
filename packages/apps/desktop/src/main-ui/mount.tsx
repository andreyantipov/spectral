import type { ManagedRuntime } from "effect";
import { render } from "solid-js/web";
import App from "./App";

export function mount(runtime: ManagedRuntime.ManagedRuntime<never, never>) {
	const root = document.getElementById("root");
	if (root) {
		render(() => <App runtime={runtime} />, root);
	}
}
