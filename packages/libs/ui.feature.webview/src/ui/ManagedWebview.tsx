import type { Component } from "solid-js";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type { ManagedWebviewProps, WebviewElement } from "../lib/types";

const DEFAULT_MASKS = ".webview-overlay";
const FIRST_REVEAL_DELAY = 400;
const SUBSEQUENT_REVEAL_DELAY = 50;

export const ManagedWebview: Component<ManagedWebviewProps> = (props) => {
	let containerRef: HTMLDivElement | undefined;
	let webviewRef: WebviewElement | undefined;
	let hasBeenRevealedOnce = false;
	let revealTimer: ReturnType<typeof setTimeout> | null = null;
	let currentLoadedUrl: string | undefined;

	const [isWebviewReady, setIsWebviewReady] = createSignal(false);
	const [revealReady, setRevealReady] = createSignal(false);

	// Create the webview element once on mount
	onMount(() => {
		if (!containerRef) return;

		const el = document.createElement("electrobun-webview") as unknown as WebviewElement;
		const htmlEl = el as unknown as HTMLElement;

		// Set initial attributes — start transparent and passthrough
		htmlEl.setAttribute("transparent", "");
		htmlEl.setAttribute("passthrough", "");

		if (props.preload) {
			htmlEl.setAttribute("preload", props.preload);
		}

		if (props.url && props.url !== "about:blank") {
			htmlEl.setAttribute("src", props.url);
			currentLoadedUrl = props.url;
		}

		htmlEl.style.cssText =
			"width: 100%; height: 100%; display: block; background: #1e1e1e; border-radius: 10px;";

		containerRef.appendChild(htmlEl);

		// Register mask selectors for DOM overlays that should punch through the native view
		const masks = props.overlayMasks ?? [DEFAULT_MASKS];
		for (const selector of masks) {
			el.addMaskSelector(selector);
		}

		// Watch for webviewId to know when native view is ready
		const observer = new MutationObserver(() => {
			if (el.webviewId != null) {
				observer.disconnect();
				requestAnimationFrame(() => {
					el.syncDimensions(true);
				});
				setIsWebviewReady(true);
			}
		});
		observer.observe(htmlEl, { attributes: true, attributeFilter: ["id"] });

		// Navigation events
		el.on("did-navigate", (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url && url !== "about:blank" && url !== currentLoadedUrl) {
				currentLoadedUrl = url;
				props.onNavigate?.(url);
			}
		});

		el.on("did-navigate-in-page", (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url && url !== "about:blank" && url !== currentLoadedUrl) {
				currentLoadedUrl = url;
				props.onNavigate?.(url);
			}
		});

		el.on("dom-ready", () => {
			el.executeJavascript("document.title")
				.then((title) => {
					if (typeof title === "string" && title.length > 0) {
						props.onTitleChange?.(title);
					}
				})
				.catch(() => {});
		});

		el.on("host-message", (event: CustomEvent) => {
			const msg = event.detail as { type?: string; url?: string } | undefined;
			if (msg?.type === "url-change" && msg.url) {
				if (msg.url !== currentLoadedUrl) {
					currentLoadedUrl = msg.url;
					props.onNavigate?.(msg.url);
				}
				return;
			}
			// Forward other host messages so keyboard-provider and others can handle them
			document.dispatchEvent(new CustomEvent("webview-host-message", { detail: msg }));
		});

		webviewRef = el;
	});

	// Reveal timing — delay before showing webview to let layout settle
	createEffect(() => {
		const active = props.isActive;
		const ready = isWebviewReady();

		if (revealTimer) {
			clearTimeout(revealTimer);
			revealTimer = null;
		}

		if (active && ready) {
			const delay = hasBeenRevealedOnce ? SUBSEQUENT_REVEAL_DELAY : FIRST_REVEAL_DELAY;
			revealTimer = setTimeout(() => {
				hasBeenRevealedOnce = true;
				setRevealReady(true);
			}, delay);
		} else {
			setRevealReady(false);
		}
	});

	// Toggle transparency and passthrough based on active state + reveal
	createEffect(() => {
		if (!webviewRef || !isWebviewReady()) return;

		if (props.isActive && revealReady()) {
			webviewRef.syncDimensions(true);
			webviewRef.toggleTransparent(false);
			webviewRef.togglePassthrough(false);
		} else {
			webviewRef.toggleTransparent(true);
			webviewRef.togglePassthrough(true);
		}
	});

	// Container display based on active state
	createEffect(() => {
		if (!containerRef) return;
		containerRef.style.display = props.isActive ? "block" : "none";
	});

	// URL changes — navigate without recreating
	createEffect(() => {
		const url = props.url;
		if (!webviewRef || !url || url === "about:blank") return;
		if (url === currentLoadedUrl) return;
		currentLoadedUrl = url;
		webviewRef.loadURL(url);
	});

	// Cleanup
	onCleanup(() => {
		if (revealTimer) clearTimeout(revealTimer);
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
};

/** Force all managed webviews to re-sync their native view dimensions */
export function syncAllWebviewDimensions() {
	document.querySelectorAll("electrobun-webview").forEach((el) => {
		(el as HTMLElement & { syncDimensions: (force?: boolean) => void }).syncDimensions(true);
	});
}
