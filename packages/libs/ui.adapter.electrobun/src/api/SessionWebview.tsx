import { createEffect, onCleanup } from "solid-js";
import { SHORTCUT_PRELOAD } from "../lib/constants";
import type { WebviewTagElement } from "../lib/types";

export type SessionWebviewProps = {
	sessionId: string;
	url: string;
	isActive: boolean;
	onNavigate: (url: string) => void;
	onTitleChange: (title: string) => void;
};

export function SessionWebview(props: SessionWebviewProps) {
	let webviewRef: WebviewTagElement | undefined;
	let containerRef: HTMLDivElement | undefined;
	let currentLoadedUrl: string | undefined;
	let lastReportedUrl: string | undefined;

	function reportUrlIfChanged(url: string) {
		if (url && url !== "about:blank") {
			currentLoadedUrl = url;
			if (url !== lastReportedUrl && props.isActive) {
				lastReportedUrl = url;
				props.onNavigate(url);
			}
		}
	}

	function createWebview(url: string) {
		if (!containerRef || webviewRef) return;
		const el = document.createElement("electrobun-webview") as unknown as WebviewTagElement;
		const htmlEl = el as unknown as HTMLElement;
		htmlEl.setAttribute("preload", SHORTCUT_PRELOAD);
		htmlEl.setAttribute("src", url);
		if (!props.isActive) {
			htmlEl.setAttribute("transparent", "");
			htmlEl.setAttribute("passthrough", "");
		}
		htmlEl.style.cssText =
			"width: 100%; height: 100%; display: block; background: #1e1e1e; border-radius: 10px;";
		containerRef.appendChild(htmlEl);
		el.addMaskSelector("[data-omnibox]");
		el.addMaskSelector("[data-sidebar]");
		el.addMaskSelector("[data-context-menu]");
		currentLoadedUrl = url;

		el.on("did-navigate", (event: CustomEvent) => {
			reportUrlIfChanged((event as CustomEvent<string>).detail);
		});
		el.on("did-navigate-in-page", (event: CustomEvent) => {
			reportUrlIfChanged((event as CustomEvent<string>).detail);
		});
		el.on("dom-ready", () => {
			el.executeJavascript("document.title")
				.then((title) => {
					if (typeof title === "string" && title.length > 0) {
						props.onTitleChange(title);
					}
				})
				.catch(() => {});
		});
		el.on("host-message", (event: CustomEvent) => {
			const msg = event.detail as { type?: string; url?: string; key?: string } | undefined;
			if (msg?.type === "url-change" && msg.url) {
				reportUrlIfChanged(msg.url);
				return;
			}
			document.dispatchEvent(new CustomEvent("webview-host-message", { detail: msg }));
		});

		webviewRef = el;
	}

	createEffect(() => {
		const url = props.url;
		if (!containerRef || !url || url === "about:blank") return;
		if (url === currentLoadedUrl) return;

		if (!webviewRef) {
			createWebview(url);
		} else {
			currentLoadedUrl = url;
			webviewRef.loadURL(url);
		}
	});

	createEffect(() => {
		if (!webviewRef) return;
		// All rendered webviews are visible and interactive in split-view.
		// Dockview only renders panels that are in the layout, so every
		// webview here should be non-transparent and non-passthrough.
		webviewRef.toggleTransparent(false);
		webviewRef.togglePassthrough(false);
		webviewRef.syncDimensions(true);
	});

	onCleanup(() => {
		if (webviewRef) {
			(webviewRef as unknown as HTMLElement).remove();
			webviewRef = undefined;
		}
	});

	return (
		<div
			ref={(el) => {
				containerRef = el;
			}}
			style="width: 100%; height: 100%; position: relative; overflow: hidden;"
		/>
	);
}

/**
 * Force all webviews to re-sync their native view dimensions.
 * Call after layout changes (splits, resizes) via requestAnimationFrame.
 */
export function syncAllWebviewDimensions() {
	document.querySelectorAll("electrobun-webview").forEach((el) => {
		(el as HTMLElement & { syncDimensions: (force?: boolean) => void }).syncDimensions(true);
	});
}
