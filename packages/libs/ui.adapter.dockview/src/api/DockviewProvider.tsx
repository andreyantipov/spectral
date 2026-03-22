import { type DockviewApi, DockviewComponent, type SerializedDockview } from "dockview-core";
import type { Component, JSX } from "solid-js";
import { onCleanup, onMount } from "solid-js";
import { createSolidRenderer, type PanelProps } from "./createSolidRenderer";

export type DockviewProviderProps = {
	components: Record<string, Component<PanelProps>>;
	onReady?: (api: DockviewApi) => void;
	onLayoutChange?: (api: DockviewApi) => void;
	initialLayout?: SerializedDockview;
	class?: string;
};

export function DockviewProvider(props: DockviewProviderProps): JSX.Element {
	let container: HTMLDivElement | undefined;
	let dockview: DockviewComponent | undefined;

	onMount(() => {
		if (!container) return;

		// Capture components at mount time — no reactive tracking
		const renderers = Object.fromEntries(
			Object.entries(props.components).map(([key, comp]) => [key, createSolidRenderer(comp)]),
		);

		dockview = new DockviewComponent(container, {
			createComponent: (options) => {
				const Renderer = renderers[options.name];
				if (!Renderer) throw new Error(`Unknown panel: ${options.name}`);
				return new Renderer();
			},
		});

		if (props.initialLayout) {
			dockview.fromJSON(props.initialLayout);
		}

		props.onReady?.(dockview.api);

		dockview.api.onDidLayoutChange(() => {
			props.onLayoutChange?.(dockview!.api);
		});
	});

	onCleanup(() => dockview?.dispose());

	const cls = () => `dockview-theme-dark${props.class ? ` ${props.class}` : ""}`;
	return <div ref={container} class={cls()} style={{ height: "100%", width: "100%" }} />;
}
