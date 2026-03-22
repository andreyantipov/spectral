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
	let resizeObserver: ResizeObserver | undefined;

	onMount(() => {
		if (!container) return;

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

		// Tell dockview its dimensions from the container
		const { offsetWidth, offsetHeight } = container;
		if (offsetWidth > 0 && offsetHeight > 0) {
			dockview.layout(offsetWidth, offsetHeight);
		}

		props.onReady?.(dockview.api);

		dockview.api.onDidLayoutChange(() => {
			props.onLayoutChange?.(dockview?.api as DockviewApi);
		});

		// Watch container size and update dockview layout
		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				if (width > 0 && height > 0) {
					dockview?.layout(width, height);
				}
			}
		});
		resizeObserver.observe(container);
	});

	onCleanup(() => {
		resizeObserver?.disconnect();
		dockview?.dispose();
	});

	const cls = () => `dockview-theme-dark${props.class ? ` ${props.class}` : ""}`;
	return <div ref={container} class={cls()} style={{ height: "100%", width: "100%" }} />;
}
