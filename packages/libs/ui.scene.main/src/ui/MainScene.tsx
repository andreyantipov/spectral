import { currentUrl } from "@ctrl/base.type";
import { BlankPage } from "@ctrl/ui.base.components";
import { KeyboardProvider } from "@ctrl/ui.feature.keyboard-provider";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import type { PanelProps } from "@ctrl/ui.feature.workspace";
import { DockviewProvider } from "@ctrl/ui.feature.workspace";
import type { DockviewApi } from "dockview-core";
import { createContext, createEffect, createMemo, Show, untrack, useContext } from "solid-js";
import { SessionWebview, syncAllWebviewDimensions } from "../lib/SessionWebview";
import { EmptyPane } from "./EmptyPane";

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

function SessionPanel(panelProps: PanelProps) {
	const bindings = useContext(BindingsContext);
	const sessionId = String(panelProps.params.sessionId ?? "");

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

// FIX #8: EmptyPane "+" — wait for session sync before closing empty panel
function EmptyPanelRenderer(panelProps: PanelProps) {
	const bindings = useContext(BindingsContext);
	return (
		<EmptyPane
			onCreateTab={() => {
				if (!bindings) return;
				bindings.createSession();
				// Wait TWO frames: 1st for session state to propagate,
				// 2nd for sync effect to add the new panel to dockview
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						try {
							panelProps.api?.close();
						} catch {
							// Panel may already be cleaned up
						}
					});
				});
			}}
		/>
	);
}

const COMPONENTS = { session: SessionPanel, empty: EmptyPanelRenderer };

function WorkspaceContent() {
	const maybeBindings = useContext(BindingsContext);
	if (!maybeBindings)
		throw new Error("WorkspaceContent must be rendered inside BindingsContext.Provider");
	const bindings = maybeBindings;
	let api: DockviewApi | undefined;
	let initialized = false;

	// Register split handler so sidebar context menu can split panes
	bindings.onSplitSession = (sessionId: string, direction: "right" | "down") => {
		if (!api) return;
		const refPanel = api.panels.find((p) => p.id === sessionId);
		if (!refPanel) return;
		const newId = `empty-${Date.now()}`;
		api.addPanel({
			id: newId,
			component: "empty",
			position: {
				referencePanel: refPanel,
				direction: direction === "right" ? "right" : "below",
			},
		});
		scheduleSync();
	};

	const sessionIds = createMemo(() => bindings.sessions().map((s) => s.id), undefined, {
		equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]),
	});

	// FIX #7: Only show BlankPage when there are NO sessions at all,
	// not when active session has about:blank (that's normal for new tabs)
	const hasSessions = () => bindings.sessions().length > 0;

	function scheduleSync() {
		requestAnimationFrame(() => syncAllWebviewDimensions());
	}

	function syncPanels(dockApi: DockviewApi, ids: string[]) {
		const existing = new Set(dockApi.panels.map((p) => p.id));
		for (const id of ids) {
			if (!existing.has(id)) {
				dockApi.addPanel({ id, component: "session", params: { sessionId: id } });
			}
		}
		// Only remove session panels that no longer exist in state
		// Keep empty panels (they start with "empty-")
		for (const panel of [...dockApi.panels]) {
			const isEmptyPanel = panel.id.startsWith("empty-");
			if (!isEmptyPanel && !ids.includes(panel.id)) {
				try {
					dockApi.removePanel(panel);
				} catch {
					// Panel may be mid-interaction
				}
			}
		}
	}

	// FIX #6: Guard panel sync - don't remove empty panels, only session panels
	createEffect(() => {
		const ids = sessionIds();
		if (!api || !initialized) return;
		syncPanels(api, ids);
		scheduleSync();
	});

	createEffect(() => {
		const activeId = bindings.activeSessionId();
		if (!api || !activeId) return;
		const panel = api.panels.find((p) => p.id === activeId);
		if (panel && api.activePanel?.id !== activeId) {
			panel.api.setActive();
		}
	});

	function handleReady(dockviewApi: DockviewApi) {
		api = dockviewApi;
		dockviewApi.onDidLayoutChange(() => scheduleSync());

		const ids = untrack(sessionIds);
		for (const id of ids) {
			dockviewApi.addPanel({ id, component: "session", params: { sessionId: id } });
		}

		const activeId = untrack(bindings.activeSessionId);
		if (activeId) {
			const panel = dockviewApi.panels.find((p) => p.id === activeId);
			if (panel) panel.api.setActive();
		}

		scheduleSync();
		initialized = true;
	}

	return (
		<div style="display: flex; flex: 1; width: 100%; height: 100%; position: relative; overflow: hidden;">
			<DockviewProvider components={COMPONENTS} onReady={handleReady} class="dv-workspace" />
			<Show when={!hasSessions()}>
				<div style="position: absolute; inset: 0; z-index: 1;">
					<BlankPage />
				</div>
			</Show>
		</div>
	);
}
