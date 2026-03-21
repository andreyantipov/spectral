import { currentUrl, type Session } from "@ctrl/core.shared";
import { BlankPage } from "@ctrl/core.ui";
import type { PanelProps } from "@ctrl/ui.adapter.dockview";
import { DockviewProvider } from "@ctrl/ui.adapter.dockview";
import { SessionWebview, syncAllWebviewDimensions } from "@ctrl/ui.adapter.electrobun";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import type { DockviewApi } from "dockview-core";
import { createEffect, createMemo, on, Show } from "solid-js";

export function MainScene() {
	return (
		<SidebarFeature>
			{(bindings: WebviewBindings) => <WorkspaceContent bindings={bindings} />}
		</SidebarFeature>
	);
}

function WorkspaceContent(props: { bindings: WebviewBindings }) {
	let dockviewApi: DockviewApi | undefined;
	let rafId: number | null = null;

	const bindings = props.bindings;

	const getSession = (id: string): Session | undefined =>
		bindings.sessions().find((s) => s.id === id);

	const sessionIds = createMemo(() => bindings.sessions().map((s) => s.id), undefined, {
		equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]),
	});

	const isActiveBlank = () => {
		const s = bindings.sessions().find((s) => s.id === bindings.activeSessionId());
		if (!s) return true;
		const url = currentUrl(s);
		return !url || url === "about:blank";
	};

	// Sync dockview panels with sessions
	createEffect(
		on(sessionIds, (ids) => {
			if (!dockviewApi) return;
			const existingPanelIds = new Set(dockviewApi.panels.map((p) => p.id));

			// Add panels for new sessions
			for (const id of ids) {
				if (!existingPanelIds.has(id)) {
					dockviewApi.addPanel({
						id,
						component: "session",
						params: { sessionId: id },
					});
				}
			}

			// Remove panels for deleted sessions
			for (const panel of dockviewApi.panels) {
				if (!ids.includes(panel.id)) {
					dockviewApi.removePanel(panel);
				}
			}

			scheduleSync();
		}),
	);

	// Sync active panel with active session
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
		api.onDidAddPanel(() => scheduleSync());

		// Add existing sessions as panels
		for (const id of sessionIds()) {
			api.addPanel({
				id,
				component: "session",
				params: { sessionId: id },
			});
		}

		// Set active panel
		const activeId = bindings.activeSessionId();
		if (activeId) {
			const panel = api.panels.find((p) => p.id === activeId);
			if (panel) panel.api.setActive();
		}

		// Force layout with reported dimensions, then sync webviews
		api.layout(api.width, api.height, true);
		scheduleSync();
		// Double-sync after a frame to catch deferred DOM updates
		requestAnimationFrame(() => scheduleSync());
	}

	// Panel component rendered inside each dockview pane
	function SessionPanel(panelProps: PanelProps) {
		const sessionId = () => String(panelProps.params.sessionId ?? "");
		const url = () => {
			const s = getSession(sessionId());
			return s ? (currentUrl(s) ?? "about:blank") : "about:blank";
		};

		return (
			<SessionWebview
				sessionId={sessionId()}
				url={url()}
				isActive={bindings.activeSessionId() === sessionId()}
				onNavigate={(navUrl) => bindings.onNavigate(sessionId(), navUrl)}
				onTitleChange={(title) => bindings.onTitleChange(sessionId(), title)}
			/>
		);
	}

	const components = { session: SessionPanel };

	return (
		<div style="display: flex; flex: 1; width: 100%; height: 100%; position: relative; overflow: hidden;">
			<DockviewProvider components={components} onReady={handleReady} class="dv-workspace" />
			<Show when={isActiveBlank()}>
				<div style="position: absolute; inset: 0; z-index: 1;">
					<BlankPage />
				</div>
			</Show>
		</div>
	);
}
