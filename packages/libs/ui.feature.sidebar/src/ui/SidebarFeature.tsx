import { type SidebarItem as CoreSidebarItem, Sidebar, useRuntime } from "@ctrl/core.ui";
import { useBrowsingRpc } from "../api/use-sidebar";
import { mapSessionsToSidebarItems } from "../model/sidebar.bindings";

export function SidebarFeature() {
	const { client, state } = useBrowsingRpc();
	const runtime = useRuntime();

	const items = (): CoreSidebarItem[] =>
		mapSessionsToSidebarItems(state()?.sessions).map((item) => ({
			id: item.id,
			label: item.label,
		}));

	const activeItemId = () =>
		mapSessionsToSidebarItems(state()?.sessions).find((item) => item.active)?.id ?? null;

	const handleNewTab = () => {
		void runtime.runPromise(client.createSession({ mode: "visual" }));
	};

	const handleItemClick = (id: string) => {
		void runtime.runPromise(client.setActive({ id }));
	};

	const handleItemClose = (id: string) => {
		void runtime.runPromise(client.removeSession({ id }));
	};

	return (
		<Sidebar
			tabs={[{ id: "sessions", icon: <span>{"#"}</span>, label: "Sessions" }]}
			activeTabId="sessions"
			items={items()}
			activeItemId={activeItemId()}
			onNewTab={handleNewTab}
			onItemClick={handleItemClick}
			onItemClose={handleItemClose}
		/>
	);
}
