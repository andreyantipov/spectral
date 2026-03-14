import { DEFAULT_TAB_URL } from "@ctrl/core.shared";
import { type SidebarItem as CoreSidebarItem, Sidebar, useRuntime } from "@ctrl/core.ui";
import { useBrowsingService } from "../api/use-sidebar";
import { mapTabsToSidebarItems } from "../model/sidebar.bindings";

export function SidebarFeature() {
	const { data, actions } = useBrowsingService();
	const runtime = useRuntime();

	const items = (): CoreSidebarItem[] =>
		mapTabsToSidebarItems(data()?.tabs).map((item) => ({
			id: item.id,
			label: item.label,
		}));

	const activeItemId = () =>
		mapTabsToSidebarItems(data()?.tabs).find((item) => item.active)?.id ?? null;

	const handleNewTab = () => {
		void runtime.runPromise(actions.createTab(DEFAULT_TAB_URL));
	};

	const handleItemClose = (id: string) => {
		void runtime.runPromise(actions.removeTab(id));
	};

	return (
		<Sidebar
			tabs={[{ id: "tabs", icon: <span>⊞</span>, label: "Tabs" }]}
			activeTabId="tabs"
			items={items()}
			activeItemId={activeItemId()}
			onNewTab={handleNewTab}
			onItemClose={handleItemClose}
		/>
	);
}
