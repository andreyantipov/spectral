import type { BrowsingState, PanelRef } from "@ctrl/base.schema";
import { useApi } from "@ctrl/ui.base.api";
import type { DockviewApi, SerializedDockview } from "dockview-core";
import { createSignal, onCleanup } from "solid-js";

export function useWorkspace() {
	const api = useApi();
	const state = api.on<BrowsingState>("state.snapshot");

	const ops = {
		updateLayout: (dockviewState: SerializedDockview) =>
			api.dispatch("ws.update-layout", { layout: { version: 1, dockviewState } }),
		splitPanel: (panelId: string, direction: "horizontal" | "vertical", newPanel: PanelRef) =>
			api.dispatch("ws.split-panel", { panelId, direction, newPanel }),
	};

	const [dockviewApi, setDockviewApi] = createSignal<DockviewApi | null>(null);

	let rafId: number | null = null;
	onCleanup(() => {
		if (rafId) cancelAnimationFrame(rafId);
	});

	const onReady = (dockApi: DockviewApi) => {
		setDockviewApi(dockApi);
		dockApi.onDidLayoutChange(() => {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				ops.updateLayout(dockApi.toJSON());
				rafId = null;
			});
		});
	};

	return { state, dockviewApi, onReady, ops };
}
