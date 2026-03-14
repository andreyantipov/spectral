import { DEFAULT_TAB_TITLE, DEFAULT_TAB_URL, type SidebarState } from "@ctrl/core.shared";
import { Sidebar, type SidebarItem, type SidebarTab } from "@ctrl/core.ui";
import { type Accessor, createSignal } from "solid-js";

export type SidebarTabsRPC = {
	request: {
		getTabs: (params: Record<string, never>) => Promise<SidebarState>;
		switchTab: (params: { id: string }) => Promise<SidebarState>;
		closeTab: (params: { id: string }) => Promise<SidebarState>;
		createTab: (params: { url: string }) => Promise<SidebarState>;
		navigateTab: (params: { url: string }) => Promise<SidebarState>;
		setSidebarSection: (params: { id: string }) => Promise<SidebarState>;
		setSidebarCollapsed: (params: { collapsed: boolean }) => Promise<SidebarState>;
		setSidebarWidth: (params: { width: number }) => Promise<SidebarState>;
	};
	addMessageListener: (name: string, handler: (state: SidebarState) => void) => void;
};

const RAIL_TABS: SidebarTab[] = [
	{ id: "tabs", icon: <span>&#9776;</span>, label: "Tabs" },
	{ id: "bookmarks", icon: <span>&#9733;</span>, label: "Bookmarks" },
	{ id: "history", icon: <span>&#8634;</span>, label: "History" },
	{ id: "downloads", icon: <span>&#8595;</span>, label: "Downloads" },
];

function hostnameFromUrl(url: string): string {
	try {
		const u = new URL(url);
		return u.hostname || url;
	} catch {
		return url || DEFAULT_TAB_TITLE;
	}
}

export type SidebarTabsController = ReturnType<typeof createSidebarTabs>;

export function createSidebarTabs() {
	const [activeSection, setActiveSection] = createSignal("tabs");
	const [collapsed, setCollapsed] = createSignal(false);
	const [tabs, setTabs] = createSignal<SidebarState["tabs"]>([]);
	const [activeTabId, setActiveTabId] = createSignal<string | null>(null);
	let rpcRef: SidebarTabsRPC | null = null;

	function applyState(state: SidebarState) {
		setTabs(state.tabs);
		setActiveTabId(state.activeTabId);
		setActiveSection(state.activeSection);
		setCollapsed(state.collapsed);
	}

	async function connect(rpc: SidebarTabsRPC) {
		rpcRef = rpc;
		rpc.addMessageListener("sidebarStateChanged", applyState);
		try {
			const initial = await rpc.request.getTabs({});
			applyState(initial);
		} catch (_e) {}
	}

	const activeUrl: Accessor<string> = () => {
		const id = activeTabId();
		const tab = tabs().find((t) => t.id === id);
		return tab?.url ?? "";
	};

	const panelItems: Accessor<SidebarItem[]> = () =>
		tabs().map((t) => ({
			id: t.id,
			label: t.title ?? hostnameFromUrl(t.url),
		}));

	const railTabs: Accessor<SidebarTab[]> = () =>
		RAIL_TABS.map((rt) => (rt.id === "tabs" ? { ...rt, badge: tabs().length || undefined } : rt));

	function switchTab(id: string) {
		rpcRef?.request.switchTab({ id });
	}

	function closeTab(id: string) {
		rpcRef?.request.closeTab({ id });
	}

	function createTab() {
		rpcRef?.request.createTab({ url: DEFAULT_TAB_URL });
	}

	function setSection(id: string) {
		rpcRef?.request.setSidebarSection({ id });
	}

	function setCollapsedState(value: boolean) {
		rpcRef?.request.setSidebarCollapsed({ collapsed: value });
	}

	function navigateTab(url: string) {
		rpcRef?.request.navigateTab({ url });
	}

	function setSidebarWidth(width: number) {
		rpcRef?.request.setSidebarWidth({ width });
	}

	return {
		activeSection,
		collapsed,
		tabs,
		activeTabId,
		activeUrl,
		panelItems,
		railTabs,
		connect,
		switchTab,
		closeTab,
		createTab,
		setSection,
		setCollapsed: setCollapsedState,
		navigateTab,
		setSidebarWidth,
	};
}

export type SidebarTabsWidgetProps = {
	controller: SidebarTabsController;
};

export function SidebarTabsWidget(props: SidebarTabsWidgetProps) {
	const c = props.controller;

	return (
		<Sidebar
			tabs={c.railTabs()}
			activeTabId={c.activeSection()}
			items={c.activeSection() === "tabs" ? c.panelItems() : []}
			activeItemId={c.activeTabId() != null ? String(c.activeTabId()) : null}
			collapsed={c.collapsed()}
			onTabClick={c.setSection}
			onItemClick={c.switchTab}
			onItemClose={c.closeTab}
			onNewTab={c.activeSection() === "tabs" ? c.createTab : undefined}
			onCollapseChange={c.setCollapsed}
			onWidthChange={(width) => c.setSidebarWidth(width)}
		/>
	);
}
