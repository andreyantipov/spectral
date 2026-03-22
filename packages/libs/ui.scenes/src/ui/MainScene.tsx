import { currentUrl, type Session } from "@ctrl/core.shared";
import { BlankPage } from "@ctrl/core.ui";
import type { PanelProps } from "@ctrl/ui.adapter.dockview";
import { DockviewProvider } from "@ctrl/ui.adapter.dockview";
import { SessionWebview, syncAllWebviewDimensions } from "@ctrl/ui.adapter.electrobun";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import type { DockviewApi } from "dockview-core";
import { createContext, createEffect, createMemo, Show, untrack, useContext } from "solid-js";

// Context to share bindings with panel components without prop-drilling
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

// Panel component rendered inside each dockview pane — stable module-level reference
function SessionPanel(panelProps: PanelProps) {
	const bindings = useContext(BindingsContext);
	const sessionId = String(panelProps.params.sessionId ?? "");

	const getSession = (): Session | undefined =>
		bindings?.sessions().find((s) => s.id === sessionId);

	const url = () => {
		const s = getSession();
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

// Stable components map — never recreated
const PANEL_COMPONENTS = { session: SessionPanel };

function WorkspaceContent() {
	const bindings = useContext(BindingsContext)!;
	let dockviewApi: DockviewApi | undefined;
	let rafId: number | null = null;
	let initialized = false;

	const sessionIds = createMemo(() => bindings.sessions().map((s) => s.id), undefined, {
		equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]),
	});

	const isActiveBlank = () => {
		const s = bindings.sessions().find((s) => s.id === bindings.activeSessionId());
		if (!s) return true;
		const url = currentUrl(s);
		return !url || url === "about:blank";
	};

	// Sync dockview panels when sessions change (skip initial — handleReady covers it)
	createEffect(() => {
		const ids = sessionIds();
		if (!dockviewApi || !initialized) return;

		const existingPanelIds = new Set(dockviewApi.panels.map((p) => p.id));

		for (const id of ids) {
			if (!existingPanelIds.has(id)) {
				dockviewApi.addPanel({ id, component: "session", params: { sessionId: id } });
			}
		}

		for (const panel of [...dockviewApi.panels]) {
			if (!ids.includes(panel.id)) {
				dockviewApi.removePanel(panel);
			}
		}

		scheduleSync();
	});

	// Sync active panel
	createEffect(() => {
		const activeId = bindings.activeSessionId();
		if (!dockviewApi || !activeId) return;
		const panel = dockviewApi.panels.find((p) => p.id === activeId);
		if (panel && dockviewApi.activePanel?.id !== activeId) {
			panel.api.setActive();
		}
	});

	function scheduleSync() {
		if (rafId) cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(() => {
			syncAllWebviewDimensions();
			rafId = null;
		});
	}

	function handleReady(api: DockviewApi) {
		dockviewApi = api;
		api.onDidLayoutChange(() => scheduleSync());

		const ids = untrack(sessionIds);
		for (const id of ids) {
			api.addPanel({ id, component: "session", params: { sessionId: id } });
		}

		const activeId = untrack(bindings.activeSessionId);
		if (activeId) {
			const panel = api.panels.find((p) => p.id === activeId);
			if (panel) panel.api.setActive();
		}

		scheduleSync();
		initialized = true;
	}

	return (
		<div style="display: flex; flex: 1; width: 100%; height: 100%; position: relative; overflow: hidden;">
			<DockviewProvider components={PANEL_COMPONENTS} onReady={handleReady} class="dv-workspace" />
			<Show when={isActiveBlank()}>
				<div style="position: absolute; inset: 0; z-index: 1;">
					<BlankPage />
				</div>
			</Show>
		</div>
	);
}
