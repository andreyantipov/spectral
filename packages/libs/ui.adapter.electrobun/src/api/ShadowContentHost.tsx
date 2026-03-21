import { createEffect, type JSX } from "solid-js";

type ContentHostProps = {
	activeSessionId: () => string;
	children: JSX.Element;
};

/**
 * Content host for session webviews.
 *
 * Visibility is controlled via CSS classes on each SessionWebview (light DOM).
 * This component syncs native view dimensions when the active session changes.
 */
export function ShadowContentHost(props: ContentHostProps) {
	let hostRef: HTMLDivElement | undefined;

	// When active session changes, force all webviews to recalculate native bounds
	createEffect(() => {
		const _activeId = props.activeSessionId();
		requestAnimationFrame(() => {
			hostRef?.querySelectorAll("electrobun-webview").forEach((wv) => {
				(wv as HTMLElement & { syncDimensions: (f?: boolean) => void }).syncDimensions(true);
			});
		});
	});

	return (
		<div
			ref={hostRef}
			id="content-host"
			style="display: flex; flex: 1; width: 100%; height: 100%; position: relative;"
		>
			{props.children}
		</div>
	);
}
