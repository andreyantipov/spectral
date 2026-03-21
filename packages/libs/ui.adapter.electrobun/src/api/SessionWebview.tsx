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
			if (url !== lastReportedUrl) {
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
		// Start transparent+passthrough — the isActive effect will show the active one
		if (!props.isActive) {
			htmlEl.setAttribute("transparent", "");
			htmlEl.setAttribute("passthrough", "");
		}
		htmlEl.style.cssText = "width: 100%; height: 100%; display: block; background: #0a0a0a;";
		containerRef.appendChild(htmlEl);
		el.addMaskSelector("[data-omnibox]");
		currentLoadedUrl = url;

		el.on("did-navigate", (event: CustomEvent) => {
			const navUrl = (event as CustomEvent<string>).detail;
			if (navUrl && navUrl !== "about:blank") {
				currentLoadedUrl = navUrl;
				if (navUrl !== lastReportedUrl) {
					lastReportedUrl = navUrl;
					props.onNavigate(navUrl);
				}
			}
		});
		el.on("did-navigate-in-page", (event: CustomEvent) => {
			const navUrl = (event as CustomEvent<string>).detail;
			if (navUrl && navUrl !== "about:blank") {
				currentLoadedUrl = navUrl;
				if (navUrl !== lastReportedUrl) {
					lastReportedUrl = navUrl;
					props.onNavigate(navUrl);
				}
			}
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

	// Create webview when URL is set (not blank)
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

	// Toggle visibility when active state changes
	createEffect(() => {
		if (!webviewRef) return;
		if (props.isActive) {
			webviewRef.toggleTransparent(false);
			webviewRef.togglePassthrough(false);
			webviewRef.syncDimensions(true);
		} else {
			webviewRef.toggleTransparent(true);
			webviewRef.togglePassthrough(true);
		}
	});

	onCleanup(() => {
		if (webviewRef) {
			(webviewRef as unknown as HTMLElement).remove();
			webviewRef = undefined;
		}
	});

	return (
		<div style="width: 100%; height: 100%; position: absolute; inset: 0;">
			<div
				ref={(el) => {
					containerRef = el;
				}}
				style="width: 100%; height: 100%; position: relative;"
			/>
		</div>
	);
}
