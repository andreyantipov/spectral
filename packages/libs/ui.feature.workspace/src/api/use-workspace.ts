import type { BrowsingState, LayoutNode, PanelRef } from "@ctrl/base.schema";
import { useApi } from "@ctrl/ui.base.api";
import type { DockviewApi } from "dockview-core";
import { createSignal, onCleanup } from "solid-js";

export function useWorkspace() {
	const api = useApi();
	const state = api.on<BrowsingState>("state.snapshot");

	const ops = {
		updateLayout: (root: LayoutNode) =>
			api.dispatch("ws.update-layout", { layout: { version: 2 as const, root } }),
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
		// TODO(Task 7/8): replace dockview with CSS Grid tiling — dockApi.toJSON() no longer relevant
		dockApi.onDidLayoutChange(() => {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				// Legacy: dockview layout change handler — will be replaced
				rafId = null;
			});
		});
	};

	return { state, dockviewApi, onReady, ops };
}
