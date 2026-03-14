import { AddressBar } from "@ctrl/core.ui";
import {
	createSidebarTabs,
	type SidebarTabsRPC,
	SidebarTabsWidget,
} from "@ctrl/feature.sidebar-tabs";
import { onMount } from "solid-js";

// TODO(hex-migration): Once domain.adapter.rpc is implemented, replace the legacy
// RPC-based sidebar with RuntimeProvider + MainPage from @ctrl/ui.page.main.
// The new UI components (SidebarFeature, MainPage) require a ManagedRuntime with
// BrowsingService in context, which will be provided via an RPC-backed Effect layer
// in the webview process. Until then, the existing RPC approach is preserved.

type AppProps = {
	rpcPromise: Promise<unknown>;
};

export default function App(props: AppProps) {
	const sidebar = createSidebarTabs();

	onMount(async () => {
		const rpc = await props.rpcPromise;
		if (rpc) {
			await sidebar.connect(rpc as SidebarTabsRPC);
		}
	});

	return (
		<div style={{ display: "flex", "flex-direction": "row", height: "100vh", width: "100vw" }}>
			<SidebarTabsWidget controller={sidebar} />
			<div style={{ display: "flex", "flex-direction": "column", flex: "1", "min-width": "0" }}>
				{/* Titlebar drag region — height matches macOS hiddenInset inset */}
				<div style={{ "-webkit-app-region": "drag", height: "8px", "flex-shrink": "0" }} />
				<AddressBar
					url={sidebar.activeUrl()}
					onNavigate={(url) => sidebar.navigateTab(url)}
					onBack={() => {}}
					onForward={() => {}}
				/>
				{/* Passthrough area — lets clicks reach the content BrowserView below */}
				<div style={{ flex: "1", "pointer-events": "none" }} />
			</div>
		</div>
	);
}
