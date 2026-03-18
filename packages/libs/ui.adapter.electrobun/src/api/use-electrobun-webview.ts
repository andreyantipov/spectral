import { createEffect, onCleanup } from "solid-js";
import type { WebviewHookProps, WebviewHookResult, WebviewTagElement } from "../lib/types";
import { createWebviewPool } from "./webview-pool";

export function useElectrobunWebview(props: () => WebviewHookProps): WebviewHookResult {
	const pool = createWebviewPool();
	let containerEl: HTMLDivElement | undefined;

	function attachEvents(el: WebviewTagElement, _sessionId: string) {
		const handleNavigate = (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url) props().onNavigate(url);
		};

		const handleNavigateInPage = (event: CustomEvent) => {
			const url = (event as CustomEvent<string>).detail;
			if (url) props().onNavigate(url);
		};

		const handleDomReady = () => {
			props().onDomReady();
			// Extract title after DOM is ready
			el.executeJavascript("document.title")
				.then((title) => {
					if (typeof title === "string" && title.length > 0) {
						props().onTitleChange(title);
					}
				})
				.catch(() => {
					// Title extraction failed — skip silently, fallback to URL hostname
				});
		};

		const handleHostMessage = (event: CustomEvent) => {
			// Forward host messages to document for shortcut handling
			document.dispatchEvent(new CustomEvent("webview-host-message", { detail: event.detail }));
		};

		el.on("did-navigate", handleNavigate);
		el.on("did-navigate-in-page", handleNavigateInPage);
		el.on("dom-ready", handleDomReady);
		el.on("host-message", handleHostMessage);

		return () => {
			el.off("did-navigate", handleNavigate);
			el.off("did-navigate-in-page", handleNavigateInPage);
			el.off("dom-ready", handleDomReady);
			el.off("host-message", handleHostMessage);
		};
	}

	let cleanupEvents: (() => void) | undefined;
	let currentSessionId: string | undefined;

	// React to session changes
	createEffect(() => {
		const { sessionId, url } = props();
		if (!containerEl || !sessionId) return;

		const isNewSession = sessionId !== currentSessionId;
		currentSessionId = sessionId;

		if (isNewSession) {
			cleanupEvents?.();
			pool.hideAll();
		}

		const entry = pool.getOrCreate(sessionId);
		const el = entry.el as unknown as HTMLElement;

		// Add to DOM BEFORE loadURL — Electrobun custom element needs to be connected
		if (!el.parentElement) {
			containerEl.appendChild(el);
		}
		pool.show(sessionId);

		// Only load URL on first visit to this session (new webview)
		if (isNewSession && url && url !== "about:blank") {
			entry.el.loadURL(url);
		}

		if (isNewSession) {
			cleanupEvents = attachEvents(entry.el, sessionId);
		}
	});

	// React to mask selector changes
	createEffect(() => {
		const masks = props().maskSelectors ?? [];
		if (masks.length > 0) {
			pool.syncMasks(masks);
		}
	});

	onCleanup(() => {
		cleanupEvents?.();
	});

	return {
		containerRef: (el: HTMLDivElement) => {
			containerEl = el;
		},
	};
}
