import { AddressBar } from "@ctrl/core.ui";
import { createSidebarTabs, SidebarTabsWidget } from "@ctrl/feature.sidebar-tabs";
import { onMount } from "solid-js";

type AppProps = {
	rpcPromise: Promise<unknown>;
};

export default function App(props: AppProps) {
	const sidebar = createSidebarTabs();

	onMount(async () => {
		const rpc = await props.rpcPromise;
		if (rpc) {
			await sidebar.connect(rpc);
		}
	});

	return (
		<div style={{ display: "flex", "flex-direction": "row", height: "100vh", width: "100vw" }}>
			<SidebarTabsWidget controller={sidebar} />
			<div style={{ display: "flex", "flex-direction": "column", flex: "1", "min-width": "0" }}>
				{/* Titlebar drag region — matches macOS hiddenInset titlebar */}
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
