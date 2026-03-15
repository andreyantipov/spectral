import { RuntimeProvider } from "@ctrl/core.ui";
import { MainPage } from "@ctrl/ui.pages";
import type { ManagedRuntime } from "effect";

type AppProps = {
	runtime: ManagedRuntime.ManagedRuntime<never, never>;
};

export default function App(props: AppProps) {
	return (
		<RuntimeProvider runtime={props.runtime}>
			<MainPage />
		</RuntimeProvider>
	);
}
