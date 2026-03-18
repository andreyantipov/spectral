import { BlankPage } from "@ctrl/core.ui";
import { useElectrobunWebview } from "@ctrl/ui.adapter.electrobun";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import { Show } from "solid-js";

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

				// Wire direct navigate so SidebarFeature can load URLs immediately after RPC
				bindings.setNavigateFn(webview.navigate);

				const isBlank = () => {
					const url = bindings.activeUrl();
					return !url || url === "about:blank";
				};

				return (
					<div style="width: 100%; height: 100%; position: relative;">
						<div ref={webview.containerRef} style="width: 100%; height: 100%;" />
						<Show when={isBlank()}>
							<div style="position: absolute; inset: 0; z-index: 1;">
								<BlankPage />
							</div>
						</Show>
					</div>
				);
			}}
		</SidebarFeature>
	);
}
