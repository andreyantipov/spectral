import type { BrowsingState, LayoutNode, PanelRef } from "@ctrl/base.schema";
import { currentUrl } from "@ctrl/base.type";
import { useApi } from "@ctrl/ui.base.api";
import { BlankPage } from "@ctrl/ui.base.components";
import { KeyboardProvider } from "@ctrl/ui.feature.keyboard-provider";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import { ManagedWebview, syncAllWebviewDimensions } from "@ctrl/ui.feature.webview";
import { LayoutRoot, useWorkspace } from "@ctrl/ui.feature.workspace";
import { createContext, createEffect, Show, useContext } from "solid-js";
import { SHORTCUT_PRELOAD } from "../lib/webview-constants";

function countPanels(node: LayoutNode): number {
	if (node.type === "group") return node.panels.length;
	return node.children.reduce((sum, c) => sum + countPanels(c), 0);
}

function collectPanelIds(node: LayoutNode): Set<string> {
	if (node.type === "group") return new Set(node.panels.map((p) => p.id));
	const ids = new Set<string>();
	for (const child of node.children) {
		for (const id of collectPanelIds(child)) ids.add(id);
	}
	return ids;
}

function resolveSessionTitle(s: {
	pages?: readonly { title?: string | null }[];
	currentIndex?: number;
}): string {
	const page = s.pages?.[s.currentIndex ?? 0];
	return page?.title ?? "New Tab";
}

function findFirstGroupId(node: LayoutNode): string | null {
	if (node.type === "group") return node.id;
	for (const child of node.children) {
		const id = findFirstGroupId(child);
		if (id) return id;
	}
	return null;
}

function makePanelFromSession(s: {
	id: string;
	pages?: readonly { title?: string | null }[];
	currentIndex?: number;
}): PanelRef {
	return {
		id: s.id,
		type: "session" as const,
		entityId: s.id,
		title: resolveSessionTitle(s),
		icon: null,
	};
}

function syncSessionsToLayout(
	api: ReturnType<typeof useApi>,
	sessions: readonly {
		id: string;
		isActive?: boolean;
		pages?: readonly { title?: string | null }[];
		currentIndex?: number;
	}[],
	currentLayout: LayoutNode | null,
) {
	const sessionIds = new Set(sessions.map((s) => s.id));
	const layoutPanelIds = currentLayout ? collectPanelIds(currentLayout) : new Set<string>();
	const missing = sessions.filter((s) => !layoutPanelIds.has(s.id));
	const stale = [...layoutPanelIds].filter((id) => !sessionIds.has(id));
	if (missing.length === 0 && stale.length === 0) return;

	if (!currentLayout || countPanels(currentLayout) === 0) {
		const panels = sessions.map(makePanelFromSession);
		const activePanel = sessions.find((s) => s.isActive)?.id ?? sessions[0]?.id ?? "";
		api.dispatch("ws.update-layout", {
			layout: { version: 2, root: { id: crypto.randomUUID(), type: "group", panels, activePanel } },
		});
		return;
	}

	const firstGroupId = findFirstGroupId(currentLayout);
	for (const s of missing) {
		if (!firstGroupId) break;
		api.dispatch("ws.add-panel", { groupId: firstGroupId, panel: makePanelFromSession(s) });
	}
	for (const id of stale) {
		api.dispatch("ws.close-panel", { panelId: id });
	}
}

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
		<ManagedWebview
			sessionId={sessionId}
			url={url()}
			isActive={bindings?.activeSessionId() === sessionId}
			overlayMasks={["[data-sidebar]", "[data-omnibox]", "[data-context-menu]"]}
			preload={SHORTCUT_PRELOAD}
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

	// Sync sessions ↔ layout panels (replaces old dockview syncPanels)
	createEffect(() => {
		const sessions = browsingState()?.sessions;
		const currentLayout = layout();
		if (sessions) syncSessionsToLayout(api, sessions, currentLayout);
	});

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
