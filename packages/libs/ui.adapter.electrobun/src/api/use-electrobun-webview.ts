import { createEffect, onCleanup } from "solid-js";
import { SHORTCUT_PRELOAD } from "../lib/constants";
import type { WebviewHookProps, WebviewHookResult, WebviewTagElement } from "../lib/types";

export function useElectrobunWebview(props: () => WebviewHookProps): WebviewHookResult {
	let containerEl: HTMLDivElement | undefined;
	const webviews = new Map<string, WebviewTagElement>();
	const loadedUrls = new Map<string, string>();
	let activeSessionId: string | undefined;

	function createAndMount(sessionId: string, url: string): WebviewTagElement {
		const el = document.createElement("electrobun-webview") as unknown as WebviewTagElement;
		(el as unknown as HTMLElement).setAttribute("preload", SHORTCUT_PRELOAD);
		(el as unknown as HTMLElement).style.cssText =
			"width: 100%; height: 100%; position: absolute; inset: 0;";

		// Set URL via src attribute BEFORE appending — this is how the original code worked
		(el as unknown as HTMLElement).setAttribute("src", url);
		loadedUrls.set(sessionId, url);

		// Append to DOM
		containerEl?.appendChild(el);

		// Mask selector after DOM connection
		el.addMaskSelector("[data-omnibox]");

		// Events
		el.on("did-navigate", (event: CustomEvent) => {
			const u = (event as CustomEvent<string>).detail;
			if (u) {
				loadedUrls.set(sessionId, u);
				props().onNavigate(u);
			}
		});
		el.on("did-navigate-in-page", (event: CustomEvent) => {
			const u = (event as CustomEvent<string>).detail;
			if (u) {
				loadedUrls.set(sessionId, u);
				props().onNavigate(u);
			}
		});
		el.on("dom-ready", () => {
			props().onDomReady();
			el.executeJavascript("document.title")
				.then((title) => {
					if (typeof title === "string" && title.length > 0) {
						props().onTitleChange(title);
					}
				})
				.catch(() => {});
		});
		el.on("host-message", (event: CustomEvent) => {
			document.dispatchEvent(
				new CustomEvent("webview-host-message", {
					detail: event.detail,
				}),
			);
		});

		webviews.set(sessionId, el);
		return el;
	}

	createEffect(() => {
		const { sessionId, url } = props();
		if (!containerEl || !sessionId) return;

		const isSwitch = sessionId !== activeSessionId;
		const hasRealUrl = url && url !== "about:blank";

		if (isSwitch) {
			// Remove previous webview from DOM (native view disappears)
			if (activeSessionId) {
				const prev = webviews.get(activeSessionId);
				if (prev) {
					(prev as unknown as HTMLElement).remove();
				}
			}
			activeSessionId = sessionId;

			const existing = webviews.get(sessionId);
			if (existing) {
				// Re-append existing webview (native view reappears, state may be preserved)
				containerEl?.appendChild(existing);
			} else if (hasRealUrl) {
				// Create webview only for real URLs — about:blank shows BlankPage component
				createAndMount(sessionId, url);
			}
			// If about:blank and no existing webview: do nothing — BlankPage DOM shows through
			return;
		}

		// URL change within same session (omnibox navigation)
		if (hasRealUrl) {
			const existing = webviews.get(sessionId);
			const lastLoaded = loadedUrls.get(sessionId);
			if (existing) {
				// Existing webview — load new URL if different from what webview reported
				if (url !== lastLoaded) {
					loadedUrls.set(sessionId, url);
					existing.loadURL(url);
				}
			} else {
				// First real URL for this session — create webview now
				createAndMount(sessionId, url);
			}
		}
	});

	onCleanup(() => {});

	return {
		containerRef: (el: HTMLDivElement) => {
			containerEl = el;
			(el as HTMLDivElement).style.position = "relative";
		},
	};
}
