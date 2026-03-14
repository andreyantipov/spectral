import { SidebarFeature } from "@ctrl/ui.feature.sidebar";

export function MainPage() {
	return (
		<div style={{ display: "flex", height: "100vh" }}>
			<SidebarFeature />
			<main style={{ flex: 1 }}>{/* Content area — BrowserView will be added here */}</main>
		</div>
	);
}
