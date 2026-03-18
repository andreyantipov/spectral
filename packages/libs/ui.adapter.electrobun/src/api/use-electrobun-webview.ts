import { createEffect, onCleanup } from "solid-js";
import { SHORTCUT_PRELOAD } from "../lib/constants";
import type { WebviewHookProps, WebviewHookResult, WebviewTagElement } from "../lib/types";

export function useElectrobunWebview(props: () => WebviewHookProps): WebviewHookResult {
	let containerEl: HTMLDivElement | undefined;
	let webviewEl: WebviewTagElement | undefined;
	let lastLoadedUrl: string | undefined;
	let webviewReportedUrl = false;

	function setupWebview(el: WebviewTagElement) {
		// Mask selector so omnibox overlay is visible above native view
		el.addMaskSelector("[data-omnibox]");

		// Navigation events from the webview
		el.on("did-navigate", (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url) {
				webviewReportedUrl = true;
				lastLoadedUrl = url;
				props().onNavigate(url);
			}
		});

		el.on("did-navigate-in-page", (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url) {
				webviewReportedUrl = true;
				lastLoadedUrl = url;
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
			document.dispatchEvent(new CustomEvent("webview-host-message", { detail: event.detail }));
		});
	}

	// React to URL changes — load new URLs in the webview
	createEffect(() => {
		const { url } = props();
		if (!webviewEl || !url || url === "about:blank") return;

		// Skip if this URL change came from the webview itself
		if (webviewReportedUrl) {
			webviewReportedUrl = false;
			return;
		}

		// Only load if URL actually changed
		if (url !== lastLoadedUrl) {
			lastLoadedUrl = url;
			webviewEl.loadURL(url);
		}
	});

	// Sync mask dimensions when omnibox opens/closes
	createEffect(() => {
		const masks = props().maskSelectors ?? [];
		if (webviewEl && masks.length > 0) {
			for (const sel of masks) {
				webviewEl.addMaskSelector(sel);
			}
			webviewEl.syncDimensions(true);
		}
	});

	onCleanup(() => {
		// Events are attached to the element — they die with it
	});

	return {
		containerRef: (el: HTMLDivElement) => {
			containerEl = el;
			// Create the webview element once, append to container
			const wv = document.createElement("electrobun-webview") as unknown as WebviewTagElement;
			(wv as unknown as HTMLElement).setAttribute("preload", SHORTCUT_PRELOAD);
			// Set src to blank HTML to prevent Electrobun loading its default homepage
			(wv as unknown as HTMLElement).setAttribute("html", "<html><body></body></html>");
			(wv as unknown as HTMLElement).style.cssText =
				"width: 100%; height: 100%; display: block; background: #fff;";
			containerEl.appendChild(wv);
			webviewEl = wv;
			setupWebview(wv);
		},
	};
}
