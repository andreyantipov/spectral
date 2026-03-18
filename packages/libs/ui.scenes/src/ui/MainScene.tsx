import { useElectrobunWebview } from "@ctrl/ui.adapter.electrobun";
import { SidebarFeature, useBrowsingCallbacks } from "@ctrl/ui.feature.sidebar";

export function MainScene() {
	const browsing = useBrowsingCallbacks();

	const webview = useElectrobunWebview(() => ({
		sessionId: browsing.activeSessionId(),
		url: browsing.activeUrl() ?? "about:blank",
		onNavigate: browsing.onNavigate,
		onTitleChange: browsing.onTitleChange,
		onDomReady: () => {},
	}));

	return (
		<SidebarFeature>
			<div ref={webview.containerRef} style="width: 100%; height: 100%;" />
		</SidebarFeature>
	);
}
