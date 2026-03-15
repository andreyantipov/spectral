import { DEFAULT_TAB_URL } from "@ctrl/core.shared";
import { BrowserView, type BrowserWindow } from "electrobun/bun";

const CHROME_HEIGHT = 28; // macOS titlebar height (titleBarStyle: hiddenInset)
const RAIL_WIDTH = 48; // Sidebar rail width when collapsed
const DEFAULT_SIDEBAR_WIDTH = 240; // Sidebar component default width (includes rail)

/**
 * ViewManager is responsible for BrowserView lifecycle management only.
 * It has NO domain logic — no database calls, no session/tab services.
 * It receives instructions (create, destroy, navigate, activate) and
 * manages the native BrowserView instances accordingly.
 */
export class ViewManager {
	private contentView: BrowserView | null = null;
	private win: BrowserWindow | null = null;
	private windowId: number = 0;
	private collapsed: boolean = false;
	private sidebarWidth: number = DEFAULT_SIDEBAR_WIDTH;

	setWindow(win: BrowserWindow) {
		this.win = win;
		this.windowId = win.id;
	}

	/** Create (or replace) the content BrowserView with the given URL. */
	createContentView(url: string) {
		if (this.contentView) {
			this.contentView.remove();
			this.contentView = null;
		}

		const frame = this.getContentFrame();

		this.contentView = new BrowserView({
			url: url === DEFAULT_TAB_URL ? null : url,
			html: url === DEFAULT_TAB_URL ? "<html><body></body></html>" : null,
			frame,
			windowId: this.windowId,
			sandbox: true,
			autoResize: true,
		});
	}

	/** Navigate the existing content BrowserView to a new URL. */
	navigateContentView(url: string) {
		if (!this.contentView) return;
		if (url === DEFAULT_TAB_URL) {
			this.contentView.loadHTML("<html><body></body></html>");
		} else {
			this.contentView.loadURL(url);
		}
	}

	/** Destroy the current content BrowserView. */
	destroyContentView() {
		if (this.contentView) {
			this.contentView.remove();
			this.contentView = null;
		}
	}

	/** Temporarily hide content view by recreating at offscreen position. */
	setContentViewVisible(visible: boolean) {
		if (!this.contentView) return;
		if (visible) {
			const currentUrl = this.contentView.url ?? DEFAULT_TAB_URL;
			this.createContentView(currentUrl);
		} else {
			// Recreate offscreen to hide — preserves URL for restoration
			const url = this.contentView.url ?? DEFAULT_TAB_URL;
			this.contentView.remove();
			this.contentView = new BrowserView({
				url: url === DEFAULT_TAB_URL ? null : url,
				html: url === DEFAULT_TAB_URL ? "<html><body></body></html>" : null,
				frame: { x: -9999, y: -9999, width: 1, height: 1 },
				windowId: this.windowId,
				sandbox: true,
			});
		}
	}

	/** Update sidebar collapsed state and reposition the content view. */
	setSidebarCollapsed(collapsed: boolean) {
		this.collapsed = collapsed;
		this.repositionContentView();
	}

	/** Update sidebar width and reposition the content view. */
	setSidebarWidth(width: number) {
		this.sidebarWidth = width;
		this.repositionContentView();
	}

	private getContentFrame() {
		const winSize = this.win?.getSize() ?? { width: 1200, height: 800 };
		const sidebarX = this.collapsed ? RAIL_WIDTH : this.sidebarWidth;
		return {
			x: sidebarX,
			y: CHROME_HEIGHT,
			width: winSize.width - sidebarX,
			height: winSize.height - CHROME_HEIGHT,
		};
	}

	private resizeTimer: ReturnType<typeof setTimeout> | null = null;

	private repositionContentView() {
		if (!this.contentView) return;
		// Debounce to avoid recreating on every resize tick
		if (this.resizeTimer) clearTimeout(this.resizeTimer);
		this.resizeTimer = setTimeout(() => {
			if (!this.contentView) return;
			const currentUrl = this.contentView.url ?? DEFAULT_TAB_URL;
			this.createContentView(currentUrl);
		}, 150);
	}
}
