import { RuntimeProvider } from "@ctrl/core.ui";
import { MainScene } from "@ctrl/ui.scenes";
import type { ManagedRuntime } from "effect";
import type { IpcBridgeHandle } from "./mount";

type AppProps = {
	runtime: ManagedRuntime.ManagedRuntime<never, never>;
	bridge: IpcBridgeHandle;
};

export default function App(props: AppProps) {
	// Store bridge on window for now — will be replaced by proper context
	(window as unknown as Record<string, unknown>).__ipcBridge = props.bridge;
	return (
		<RuntimeProvider runtime={props.runtime}>
			<MainScene />
		</RuntimeProvider>
	);
}
