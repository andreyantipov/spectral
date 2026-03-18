import { useElectrobunWebview } from "@ctrl/ui.adapter.electrobun";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";

export function MainScene() {
	return (
		<SidebarFeature>
			{(bindings: WebviewBindings) => {
				const webview = useElectrobunWebview(() => ({
					sessionId: bindings.activeSessionId(),
					url: bindings.activeUrl() ?? "about:blank",
					onNavigate: bindings.onNavigate,
					onTitleChange: bindings.onTitleChange,
					onDomReady: () => {},
				}));

				return <div ref={webview.containerRef} style="width: 100%; height: 100%;" />;
			}}
		</SidebarFeature>
	);
}
