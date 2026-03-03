import { BrowserView } from "electrobun/bun";
import { Effect, Runtime } from "effect";
import { TabService, type Tab } from "@ctrl/core.db";
import type { TabState } from "@ctrl/core.shared";
import type { AppLayer } from "./layers";

const CHROME_HEIGHT = 110; // 38px titlebar inset + 36px tab bar + 36px address bar

export class TabManager {
  private runtime: Runtime.Runtime<AppLayer>;
  private contentView: BrowserView | null = null;
  private rpc: any = null;
  private windowId: number = 0;

  constructor(runtime: Runtime.Runtime<AppLayer>) {
    this.runtime = runtime;
  }

  setWindowId(windowId: number) {
    this.windowId = windowId;
  }

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

    // Create content BrowserView
    this.contentView = new BrowserView({
      url: activeTab.url === "about:blank" ? null : activeTab.url,
      html: activeTab.url === "about:blank" ? "<html><body></body></html>" : null,
      frame: { x: 0, y: CHROME_HEIGHT, width: 1200, height: 800 - CHROME_HEIGHT },
      windowId: this.windowId,
      sandbox: true,
      autoResize: true,
    });

    this.contentView.on("did-navigate", (event: any) => {
      this.handleNavigation(event.url ?? event.data?.url);
    });

    await this.pushState();
  }

  async createTab(url: string): Promise<TabState> {
    await this.run(
      Effect.gen(function* () {
        const tabService = yield* TabService;
        const tab = yield* tabService.create(url);
        yield* tabService.setActive(tab.id);
      }),
    );

    this.navigateContentView(url);
    const state = await this.getTabState();
    await this.pushState();
    return state;
  }

  async closeTab(id: number): Promise<TabState> {
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
      // Create a new default tab if all tabs are closed
      await this.run(
        Effect.gen(function* () {
          const tabService = yield* TabService;
          const tab = yield* tabService.create("about:blank", "New Tab");
          yield* tabService.setActive(tab.id);
        }),
      );
    } else if (wasActive) {
      // Switch to the next available tab
      const nextTab = remaining[0];
      await this.run(
        Effect.gen(function* () {
          const tabService = yield* TabService;
          yield* tabService.setActive(nextTab.id);
        }),
      );
      this.navigateContentView(nextTab.url);
    }

    const state = await this.getTabState();
    await this.pushState();
    return state;
  }

  async switchTab(id: number): Promise<TabState> {
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

    const state = await this.getTabState();
    await this.pushState();
    return state;
  }

  async navigateTab(url: string): Promise<TabState> {
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
    const state = await this.getTabState();
    await this.pushState();
    return state;
  }

  async getTabState(): Promise<TabState> {
    return this.run(
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
  }

  private async pushState() {
    if (!this.rpc) return;
    const state = await this.getTabState();
    this.rpc.send.tabsChanged(state);
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
