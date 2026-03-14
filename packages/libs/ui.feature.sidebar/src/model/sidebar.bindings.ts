import type { Tab } from "@ctrl/core.shared";

export type SidebarItem = {
	readonly id: string;
	readonly label: string;
	readonly active: boolean;
};

const safeHostname = (url: string): string => {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
};

export const mapTabsToSidebarItems = (tabs: Tab[] | undefined): SidebarItem[] =>
	tabs?.map((tab) => ({
		id: tab.id,
		label: tab.title ?? safeHostname(tab.url),
		active: tab.isActive,
	})) ?? [];
