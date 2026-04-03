import type { BrowsingState, PanelRef } from "@ctrl/base.schema";
import { currentUrl } from "@ctrl/base.type";
import { useApi } from "@ctrl/ui.base.api";
import { BlankPage } from "@ctrl/ui.base.components";
import { KeyboardProvider } from "@ctrl/ui.feature.keyboard-provider";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import { LayoutRoot, useWorkspace } from "@ctrl/ui.feature.workspace";
import { createContext, Show, useContext } from "solid-js";
import { SessionWebview, syncAllWebviewDimensions } from "../lib/SessionWebview";

const BindingsContext = createContext<WebviewBindings>();

export function MainScene() {
	return (
		<KeyboardProvider>
			<SidebarFeature>
				{(bindings: WebviewBindings) => (
					<BindingsContext.Provider value={bindings}>
						<WorkspaceContent />
					</BindingsContext.Provider>
				)}
			</SidebarFeature>
		</KeyboardProvider>
	);
}

function SessionPanel(props: { panel: PanelRef }) {
	const bindings = useContext(BindingsContext);
	const sessionId = props.panel.entityId;

	const url = () => {
		const s = bindings?.sessions().find((s) => s.id === sessionId);
		return s ? (currentUrl(s) ?? "about:blank") : "about:blank";
	};

	return (
		<SessionWebview
			sessionId={sessionId}
			url={url()}
			isActive={bindings?.activeSessionId() === sessionId}
			onNavigate={(navUrl) => bindings?.onNavigate(sessionId, navUrl)}
			onTitleChange={(title) => bindings?.onTitleChange(sessionId, title)}
		/>
	);
}

function WorkspaceContent() {
	const maybeBindings = useContext(BindingsContext);
	if (!maybeBindings)
		throw new Error("WorkspaceContent must be rendered inside BindingsContext.Provider");
	const bindings = maybeBindings;
	const api = useApi();
	const browsingState = api.on<BrowsingState>("browsing.snapshot");

	const { layout, focusedGroupId, setFocusedGroupId, handleCommand } = useWorkspace();

	const hasSessions = () => (browsingState()?.sessions?.length ?? 0) > 0;

	// Register split handler so sidebar context menu can split panes
	bindings.onSplitSession = (sessionId: string, direction: "right" | "down") => {
		api.dispatch("ws.split-panel", {
			panelId: sessionId,
			direction: direction === "right" ? "horizontal" : "vertical",
			newPanel: {
				id: crypto.randomUUID(),
				type: "session" as const,
				entityId: sessionId,
				title: "New Tab",
				icon: null,
			},
		});
	};

	const renderViewport = (panel: PanelRef) => {
		if (panel.type === "session") {
			return <SessionPanel panel={panel} />;
		}
		return <div style="width: 100%; height: 100%; background: #1e1e1e;" />;
	};

	return (
		<div style="display: flex; flex: 1; width: 100%; height: 100%; position: relative; overflow: hidden;">
			<Show
				when={layout()}
				fallback={
					<Show when={!hasSessions()}>
						<BlankPage />
					</Show>
				}
			>
				{(rootLayout) => (
					<LayoutRoot
						layout={rootLayout()}
						focusedGroupId={focusedGroupId()}
						renderViewport={renderViewport}
						onCommand={(cmd) => {
							handleCommand(cmd);
							// Sync webview dimensions after layout changes
							requestAnimationFrame(() => syncAllWebviewDimensions());
						}}
						onGroupFocus={setFocusedGroupId}
					/>
				)}
			</Show>
			<Show when={!hasSessions()}>
				<div style="position: absolute; inset: 0; z-index: 1;">
					<BlankPage />
				</div>
			</Show>
		</div>
	);
}
