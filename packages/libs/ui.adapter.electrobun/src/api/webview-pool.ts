import { MAX_LIVE_WEBVIEWS, SHORTCUT_PRELOAD } from "../lib/constants";
import type { WebviewTagElement } from "../lib/types";

type PoolEntry = {
	el: WebviewTagElement;
	sessionId: string;
	lastActive: number;
};

export function createWebviewPool() {
	const pool = new Map<string, PoolEntry>();

	function createWebview(_sessionId: string): WebviewTagElement {
		const el = document.createElement("electrobun-webview") as unknown as WebviewTagElement;
		(el as unknown as HTMLElement).setAttribute("preload", SHORTCUT_PRELOAD);
		(el as unknown as HTMLElement).style.cssText =
			"width: 100%; height: 100%; display: block; background: #fff;";
		// Cut a hole in the native view where the OmniBox overlay renders.
		// Without this, the native view covers the DOM-rendered omnibox.
		el.addMaskSelector("[data-omnibox]");
		return el;
	}

	function evictLRU() {
		if (pool.size <= MAX_LIVE_WEBVIEWS) return;
		let oldest: string | null = null;
		let oldestTime = Number.POSITIVE_INFINITY;
		for (const [id, entry] of pool) {
			if (entry.lastActive < oldestTime) {
				oldest = id;
				oldestTime = entry.lastActive;
			}
		}
		if (oldest) {
			const entry = pool.get(oldest);
			if (entry) {
				(entry.el as unknown as HTMLElement).remove();
				pool.delete(oldest);
			}
		}
	}

	return {
		get(sessionId: string): PoolEntry | undefined {
			return pool.get(sessionId);
		},

		getOrCreate(sessionId: string): PoolEntry {
			let entry = pool.get(sessionId);
			if (!entry) {
				evictLRU();
				const el = createWebview(sessionId);
				entry = { el, sessionId, lastActive: Date.now() };
				pool.set(sessionId, entry);
			} else {
				entry.lastActive = Date.now();
			}
			return entry;
		},

		hideAll() {
			for (const entry of pool.values()) {
				(entry.el as unknown as HTMLElement).style.display = "none";
			}
		},

		show(sessionId: string) {
			const entry = pool.get(sessionId);
			if (entry) {
				(entry.el as unknown as HTMLElement).style.display = "block";
			}
		},

		remove(sessionId: string) {
			const entry = pool.get(sessionId);
			if (entry) {
				(entry.el as unknown as HTMLElement).remove();
				pool.delete(sessionId);
			}
		},

		syncMasks(selectors: readonly string[]) {
			for (const entry of pool.values()) {
				for (const sel of selectors) {
					entry.el.addMaskSelector(sel);
				}
				entry.el.syncDimensions(true);
			}
		},
	};
}
