import type { Tab } from "@ctrl/core.shared";

export type SidebarItem = {
	readonly id: string;
	readonly label: string;
	readonly active: boolean;
};

export const mapTabsToSidebarItems = (tabs: Tab[] | undefined): SidebarItem[] =>
	tabs?.map((tab) => ({
		id: tab.id,
		label: tab.title ?? (tab.url.startsWith("http") ? new URL(tab.url).hostname : tab.url),
		active: tab.isActive,
	})) ?? [];
