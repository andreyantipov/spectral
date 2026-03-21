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
			// Only report navigations for the active webview to prevent
			// background webview redirects from contaminating other sessions
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
		// Start transparent+passthrough — the isActive effect will show the active one
		if (!props.isActive) {
			htmlEl.setAttribute("transparent", "");
			htmlEl.setAttribute("passthrough", "");
		}
		htmlEl.style.cssText =
			"width: 100%; height: 100%; display: block; background: #1e1e1e; border-radius: 10px;";
		containerRef.appendChild(htmlEl);
		el.addMaskSelector("[data-omnibox]");
		el.addMaskSelector("[data-sidebar]");
		currentLoadedUrl = url;

		el.on("did-navigate", (event: CustomEvent) => {
			const navUrl = (event as CustomEvent<string>).detail;
			reportUrlIfChanged(navUrl);
		});
		el.on("did-navigate-in-page", (event: CustomEvent) => {
			const navUrl = (event as CustomEvent<string>).detail;
			reportUrlIfChanged(navUrl);
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
