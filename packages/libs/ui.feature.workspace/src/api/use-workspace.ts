import type { PanelRef } from "@ctrl/core.base.model";
import { useApi, useRuntime } from "@ctrl/core.ui.api";
import { WorkspaceRpcs } from "@ctrl/domain.service.workspace";
import { RpcClient } from "@effect/rpc";
import type { Protocol } from "@effect/rpc/RpcClient";
import type { DockviewApi, SerializedDockview } from "dockview-core";
import { Effect, Exit, type ManagedRuntime, Scope } from "effect";
import { createResource, createSignal, onCleanup } from "solid-js";

export function useWorkspace() {
	const api = useApi();
	const runtime = useRuntime() as unknown as ManagedRuntime.ManagedRuntime<
		Protocol | Scope.Scope,
		never
	>;

	const scope = runtime.runSync(Scope.make());
	onCleanup(() => runtime.runSync(Scope.close(scope, Exit.void)));

	const client = runtime.runSync(
		RpcClient.make(WorkspaceRpcs).pipe(Effect.provideService(Scope.Scope, scope)),
	) as RpcClient.FromGroup<typeof WorkspaceRpcs>;

	const ops = {
		getLayout: () => runtime.runPromise(client.getLayout()),
		updateLayout: (dockviewState: SerializedDockview) =>
			runtime.runPromise(client.updateLayout({ layout: { version: 1, dockviewState } })),
		splitPanel: (panelId: string, direction: "horizontal" | "vertical", newPanel: PanelRef) =>
			api.dispatch("ws.split-panel", { panelId, direction, newPanel }),
	};

	const [initialLayout] = createResource(() => ops.getLayout());

	const [dockviewApi, setDockviewApi] = createSignal<DockviewApi | null>(null);

	let rafId: number | null = null;
	onCleanup(() => {
		if (rafId) cancelAnimationFrame(rafId);
	});

	const onReady = (api: DockviewApi) => {
		setDockviewApi(api);
		api.onDidLayoutChange(() => {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				void ops.updateLayout(api.toJSON());
				rafId = null;
			});
		});
	};

	return { initialLayout, dockviewApi, onReady, ops };
}
