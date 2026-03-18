import { createEffect, onCleanup } from "solid-js";
import { SHORTCUT_PRELOAD } from "../lib/constants";
import type { WebviewHookProps, WebviewHookResult, WebviewTagElement } from "../lib/types";

export function useElectrobunWebview(props: () => WebviewHookProps): WebviewHookResult {
	let containerEl: HTMLDivElement | undefined;
	let webviewEl: WebviewTagElement | undefined;
	let currentUrl: string | undefined;
	let webviewReportedUrl = false;

	function ensureWebview(): WebviewTagElement {
		if (webviewEl) return webviewEl;
		const el = document.createElement("electrobun-webview") as unknown as WebviewTagElement;
		(el as unknown as HTMLElement).setAttribute("preload", SHORTCUT_PRELOAD);
		(el as unknown as HTMLElement).setAttribute(
			"html",
			"<html><body style='background:#0a0a0a'></body></html>",
		);
		(el as unknown as HTMLElement).style.cssText =
			"width: 100%; height: 100%; position: absolute; inset: 0;";
		containerEl?.appendChild(el);
		el.addMaskSelector("[data-omnibox]");
		webviewEl = el;

		el.on("did-navigate", (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url) {
				webviewReportedUrl = true;
				currentUrl = url;
				props().onNavigate(url);
			}
		});
		el.on("did-navigate-in-page", (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url) {
				webviewReportedUrl = true;
				currentUrl = url;
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
				.catch(() => {});
		});
		el.on("host-message", (event: CustomEvent) => {
			document.dispatchEvent(new CustomEvent("webview-host-message", { detail: event.detail }));
		});

		return el;
	}

	createEffect(() => {
		const { url } = props();
		if (!containerEl) return;
		if (!url || url === "about:blank") {
			// Hide webview for blank pages so BlankPage component shows
			if (webviewEl) {
				(webviewEl as unknown as HTMLElement).remove();
				webviewEl = undefined;
				currentUrl = undefined;
			}
			return;
		}

		// Skip if webview itself reported this URL
		if (webviewReportedUrl) {
			webviewReportedUrl = false;
			return;
		}

		// Load URL if changed
		if (url !== currentUrl) {
			const el = ensureWebview();
			currentUrl = url;
			el.loadURL(url);
		}
	});

	onCleanup(() => {});

	return {
		containerRef: (el: HTMLDivElement) => {
			containerEl = el;
			(el as HTMLDivElement).style.position = "relative";
		},
		navigate: (url: string) => {
			if (!containerEl || !url || url === "about:blank") return;
			const el = ensureWebview();
			currentUrl = url;
			el.loadURL(url);
		},
	};
}
