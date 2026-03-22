import { currentUrl } from "@ctrl/core.shared";
import { BlankPage } from "@ctrl/core.ui";
import type { PanelProps } from "@ctrl/ui.adapter.dockview";
import { DockviewProvider } from "@ctrl/ui.adapter.dockview";
import { SessionWebview, syncAllWebviewDimensions } from "@ctrl/ui.adapter.electrobun";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import type { DockviewApi } from "dockview-core";
import { createContext, createEffect, createMemo, Show, untrack, useContext } from "solid-js";
import { EmptyPane } from "./EmptyPane";

const BindingsContext = createContext<WebviewBindings>();

export function MainScene() {
	return (
		<SidebarFeature>
			{(bindings: WebviewBindings) => (
				<BindingsContext.Provider value={bindings}>
					<WorkspaceContent />
				</BindingsContext.Provider>
			)}
		</SidebarFeature>
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

function EmptyPanelRenderer(panelProps: PanelProps) {
	const bindings = useContext(BindingsContext);
	return (
		<EmptyPane
			onCreateTab={() => {
				if (!bindings) return;
				// Create a new session, then replace this empty panel with the session panel
				bindings.createSession().then(() => {
					// The session sync effect will add the new session panel.
					// Remove this empty panel after a short delay to let the sync happen first.
					requestAnimationFrame(() => {
						try {
							// Access the panel's group to add the new session there
							const panelApi = panelProps.api;
							if (panelApi) {
								// Close this empty panel — the session sync effect handles adding the new one
								panelApi.close();
							}
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
		// Create a new empty panel next to the reference in the specified direction
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

	const isActiveBlank = () => {
		const s = bindings.sessions().find((s) => s.id === bindings.activeSessionId());
		if (!s) return true;
		const url = currentUrl(s);
		return !url || url === "about:blank";
	};

	function scheduleSync() {
		requestAnimationFrame(() => syncAllWebviewDimensions());
	}

	createEffect(() => {
		const ids = sessionIds();
		if (!api || !initialized) return;

		const existing = new Set(api.panels.map((p) => p.id));
		for (const id of ids) {
			if (!existing.has(id)) {
				api.addPanel({ id, component: "session", params: { sessionId: id } });
			}
		}
		for (const panel of [...api.panels]) {
			if (!ids.includes(panel.id)) {
				api.removePanel(panel);
			}
		}
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
			<Show when={isActiveBlank()}>
				<div style="position: absolute; inset: 0; z-index: 1;">
					<BlankPage />
				</div>
			</Show>
		</div>
	);
}
