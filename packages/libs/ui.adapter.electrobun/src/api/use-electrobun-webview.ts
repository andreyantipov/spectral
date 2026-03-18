import { createEffect, onCleanup } from "solid-js";
import { SHORTCUT_PRELOAD } from "../lib/constants";
import type { WebviewHookProps, WebviewHookResult, WebviewTagElement } from "../lib/types";

export function useElectrobunWebview(props: () => WebviewHookProps): WebviewHookResult {
	let containerEl: HTMLDivElement | undefined;
	// One webview per session — preserves page state across tab switches
	const webviews = new Map<string, WebviewTagElement>();
	// Track the last URL each webview loaded (to avoid reloading on webview-reported changes)
	const loadedUrls = new Map<string, string>();
	let activeSessionId: string | undefined;

	function createWebview(sessionId: string): WebviewTagElement {
		const el = document.createElement("electrobun-webview") as unknown as WebviewTagElement;
		(el as unknown as HTMLElement).setAttribute("preload", SHORTCUT_PRELOAD);
		(el as unknown as HTMLElement).setAttribute("html", "<html><body></body></html>");
		(el as unknown as HTMLElement).style.cssText =
			"width: 100%; height: 100%; position: absolute; inset: 0;";
		el.addMaskSelector("[data-omnibox]");
		// Start hidden — will be shown when this session becomes active
		el.toggleHidden(true);
		return el;
	}

	function setupEvents(el: WebviewTagElement, sid: string) {
		el.on("did-navigate", (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url) {
				loadedUrls.set(sid, url);
				props().onNavigate(url);
			}
		});

		el.on("did-navigate-in-page", (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url) {
				loadedUrls.set(sid, url);
				props().onNavigate(url);
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
				.catch(() => {
					// Title extraction failed silently
				});
		});

		el.on("host-message", (event: CustomEvent) => {
			document.dispatchEvent(
				new CustomEvent("webview-host-message", {
					detail: event.detail,
				}),
			);
		});
	}

	// React to session switches and URL changes
	createEffect(() => {
		const { sessionId, url } = props();
		if (!containerEl || !sessionId) return;

		const isSwitch = sessionId !== activeSessionId;

		if (isSwitch) {
			// Hide the previously active webview
			if (activeSessionId) {
				const prev = webviews.get(activeSessionId);
				if (prev) prev.toggleHidden(true);
			}
			activeSessionId = sessionId;

			// Get or create the webview for this session
			let el = webviews.get(sessionId);
			if (!el) {
				el = createWebview(sessionId);
				setupEvents(el, sessionId);
				containerEl.appendChild(el);
				webviews.set(sessionId, el);

				// Load URL for new webviews
				if (url && url !== "about:blank") {
					el.loadURL(url);
				}
			}

			// Show this session's webview
			el.toggleHidden(false);
		}
		// URL change within the same session (omnibox navigation)
		if (!isSwitch && url && url !== "about:blank") {
			const el = webviews.get(sessionId);
			const lastLoaded = loadedUrls.get(sessionId);
			if (el && url !== lastLoaded) {
				loadedUrls.set(sessionId, url);
				el.loadURL(url);
			}
		}
	});

	onCleanup(() => {
		// Webviews die with the container
	});

	return {
		containerRef: (el: HTMLDivElement) => {
			containerEl = el;
			(el as HTMLDivElement).style.position = "relative";
		},
	};
}
