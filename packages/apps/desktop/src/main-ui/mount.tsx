import { render } from "solid-js/web";
import App from "./App";

export function mount(rpcPromise: Promise<unknown>) {
	const root = document.getElementById("root");
	if (root) {
		render(() => <App rpcPromise={rpcPromise} />, root);
	}
}
