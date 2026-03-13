import { TabService } from "@ctrl/core.db";
import type { SidebarState } from "@ctrl/core.shared";
import { Effect, Runtime } from "effect";
import { BrowserView, type BrowserWindow } from "electrobun/bun";
import type { AppLayer } from "./layers";

const CHROME_HEIGHT = 44; // 8px drag spacer + 36px address bar
const RAIL_WIDTH = 48; // Sidebar rail width when collapsed
const DEFAULT_SIDEBAR_WIDTH = 240; // Sidebar component default width (includes rail)

export class TabManager {
	private runtime: Runtime.Runtime<AppLayer>;
	private contentView: BrowserView | null = null;
	// biome-ignore lint/suspicious/noExplicitAny: Electrobun RPC type is not exported
	private rpc: any = null;
	private win: BrowserWindow | null = null;
	private windowId: number = 0;
	private activeSection: string = "tabs";
	private collapsed: boolean = false;
	private sidebarWidth: number = DEFAULT_SIDEBAR_WIDTH;

	constructor(runtime: Runtime.Runtime<AppLayer>) {
		this.runtime = runtime;
	}

	setWindow(win: BrowserWindow) {
		this.win = win;
		this.windowId = win.id;
	}

	// biome-ignore lint/suspicious/noExplicitAny: Electrobun RPC type is not exported
	setRPC(rpc: any) {
		this.rpc = rpc;
	}

	async init() {
		let tabs = await this.run(
			Effect.gen(function* () {
				const tabService = yield* TabService;
				return yield* tabService.getAll();
			}),
		);

		// Create default tab if none exist
		if (tabs.length === 0) {
			await this.run(
				Effect.gen(function* () {
					const tabService = yield* TabService;
					const tab = yield* tabService.create("about:blank", "New Tab");
					yield* tabService.setActive(tab.id);
				}),
			);
			tabs = await this.run(
				Effect.gen(function* () {
					const tabService = yield* TabService;
					return yield* tabService.getAll();
				}),
			);
		}

		const activeTab = tabs.find((t) => t.isActive) ?? tabs[0];

		this.createContentView(activeTab.url);
		await this.pushState();
	}

	async createTab(url: string): Promise<SidebarState> {
		await this.run(
			Effect.gen(function* () {
				const tabService = yield* TabService;
				const tab = yield* tabService.create(url);
				yield* tabService.setActive(tab.id);
			}),
		);

		this.navigateContentView(url);
		const state = await this.getSidebarState();
		await this.pushState();
		return state;
	}

	async closeTab(id: number): Promise<SidebarState> {
		const tabs = await this.run(
			Effect.gen(function* () {
				const tabService = yield* TabService;
				return yield* tabService.getAll();
			}),
		);

		const closingTab = tabs.find((t) => t.id === id);
		const wasActive = closingTab?.isActive === 1;

		await this.run(
			Effect.gen(function* () {
				const tabService = yield* TabService;
				yield* tabService.remove(id);
			}),
		);

		const remaining = await this.run(
			Effect.gen(function* () {
				const tabService = yield* TabService;
				return yield* tabService.getAll();
			}),
		);

		if (remaining.length === 0) {
			await this.run(
				Effect.gen(function* () {
					const tabService = yield* TabService;
					const tab = yield* tabService.create("about:blank", "New Tab");
					yield* tabService.setActive(tab.id);
				}),
			);
		} else if (wasActive) {
			const nextTab = remaining[0];
			await this.run(
				Effect.gen(function* () {
					const tabService = yield* TabService;
					yield* tabService.setActive(nextTab.id);
				}),
			);
			this.navigateContentView(nextTab.url);
		}

		const state = await this.getSidebarState();
		await this.pushState();
		return state;
	}

	async switchTab(id: number): Promise<SidebarState> {
		const tab = await this.run(
			Effect.gen(function* () {
				const tabService = yield* TabService;
				yield* tabService.setActive(id);
				return yield* tabService.getActive();
			}),
		);

		if (tab) {
			this.navigateContentView(tab.url);
		}

		const state = await this.getSidebarState();
		await this.pushState();
		return state;
	}

	async navigateTab(url: string): Promise<SidebarState> {
		await this.run(
			Effect.gen(function* () {
				const tabService = yield* TabService;
				const active = yield* tabService.getActive();
				if (active) {
					yield* tabService.update(active.id, { url });
				}
			}),
		);

		this.navigateContentView(url);
		const state = await this.getSidebarState();
		await this.pushState();
		return state;
	}

	async setSidebarSection(id: string): Promise<SidebarState> {
		this.activeSection = id;
		const state = await this.getSidebarState();
		await this.pushState();
		return state;
	}

	async setSidebarCollapsed(collapsed: boolean): Promise<SidebarState> {
		this.collapsed = collapsed;
		this.repositionContentView();
		const state = await this.getSidebarState();
		await this.pushState();
		return state;
	}

	async setSidebarWidth(width: number): Promise<SidebarState> {
		this.sidebarWidth = width;
		this.repositionContentView();
		const state = await this.getSidebarState();
		return state;
	}

	async getSidebarState(): Promise<SidebarState> {
		const tabState = await this.run(
			Effect.gen(function* () {
				const tabService = yield* TabService;
				const tabs = yield* tabService.getAll();
				const active = yield* tabService.getActive();
				return {
					tabs: tabs.map((t) => ({
						id: t.id,
						url: t.url,
						title: t.title,
						position: t.position,
						isActive: t.isActive,
					})),
					activeTabId: active?.id ?? null,
				};
			}),
		);

		return {
			activeSection: this.activeSection,
			collapsed: this.collapsed,
			...tabState,
		};
	}

	private async pushState() {
		if (!this.rpc) return;
		const state = await this.getSidebarState();
		this.rpc.send.sidebarStateChanged(state);
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

	private createContentView(url: string) {
		if (this.contentView) {
			this.contentView.remove();
			this.contentView = null;
		}

		const frame = this.getContentFrame();

		this.contentView = new BrowserView({
			url: url === "about:blank" ? null : url,
			html: url === "about:blank" ? "<html><body></body></html>" : null,
			frame,
			windowId: this.windowId,
			sandbox: true,
			autoResize: true,
		});

		// biome-ignore lint/suspicious/noExplicitAny: Electrobun event type is not exported
		this.contentView.on("did-navigate", (event: any) => {
			this.handleNavigation(event.url ?? event.data?.url);
		});
	}

	private resizeTimer: ReturnType<typeof setTimeout> | null = null;

	private repositionContentView() {
		if (!this.contentView) return;
		// Debounce to avoid recreating on every resize tick
		if (this.resizeTimer) clearTimeout(this.resizeTimer);
		this.resizeTimer = setTimeout(() => {
			if (!this.contentView) return;
			const currentUrl = this.contentView.url ?? "about:blank";
			this.createContentView(currentUrl);
		}, 150);
	}

	private navigateContentView(url: string) {
		if (!this.contentView) return;
		if (url === "about:blank") {
			this.contentView.loadHTML("<html><body></body></html>");
		} else {
			this.contentView.loadURL(url);
		}
	}

	private async handleNavigation(url: string | undefined) {
		if (!url) return;
		await this.run(
			Effect.gen(function* () {
				const tabService = yield* TabService;
				const active = yield* tabService.getActive();
				if (active) {
					yield* tabService.update(active.id, { url });
				}
			}),
		);
		await this.pushState();
	}

	private run<A>(effect: Effect.Effect<A, unknown, AppLayer>): Promise<A> {
		return Runtime.runPromise(this.runtime)(effect);
	}
}
