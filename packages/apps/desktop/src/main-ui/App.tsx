import { RuntimeProvider } from "@ctrl/ui.base.api";
import { MainScene } from "@ctrl/ui.scene.main";
import type { ManagedRuntime } from "effect";

type AppProps = {
	runtime: ManagedRuntime.ManagedRuntime<never, never>;
};

export default function App(props: AppProps) {
	return (
		<RuntimeProvider runtime={props.runtime}>
			<MainScene />
		</RuntimeProvider>
	);
}
