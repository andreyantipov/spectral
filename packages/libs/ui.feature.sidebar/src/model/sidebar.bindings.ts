import { type BrowsingState, currentPage, type Session } from "@ctrl/core.shared";
import type { CommandCenterItem } from "@ctrl/core.ui";

export type SidebarItem = {
	readonly id: string;
	readonly label: string;
	readonly active: boolean;
	readonly hasBack: boolean;
	readonly hasForward: boolean;
};

const displayLabel = (session: Session): string => {
	const page = currentPage(session);
	if (!page) return "New Tab";
	if (page.title) return page.title;
	try {
		return new URL(page.url).hostname;
	} catch {
		return page.url;
	}
};

export const mapSessionsToSidebarItems = (
	sessions: readonly Session[] | undefined,
): SidebarItem[] =>
	sessions?.map((session) => ({
		id: session.id,
		label: displayLabel(session),
		active: session.isActive,
		hasBack: false,
		hasForward: false,
	})) ?? [];

const safeHostname = (url: string): string => {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
};

export const buildCommandCenterItems = (state: BrowsingState | undefined): CommandCenterItem[] => {
	const items: CommandCenterItem[] = [];

	for (const session of state?.sessions ?? []) {
		const page = currentPage(session);
		items.push({
			id: `session:${session.id}`,
			label: page?.title ?? "New Tab",
			secondaryLabel: page ? `\u2014 ${safeHostname(page.url)}` : undefined,
			section: "Open Tabs",
			badge: session.isActive ? undefined : "Switch to Tab",
		});
	}

	for (const bookmark of state?.bookmarks ?? []) {
		items.push({
			id: `bookmark:${bookmark.id}`,
			label: bookmark.title ?? bookmark.url,
			secondaryLabel: `\u2014 ${safeHostname(bookmark.url)}`,
			section: "Bookmarks",
		});
	}

	items.push(
		{ id: "cmd:new-tab", icon: "+", label: "New Tab", section: "Commands" },
		{
			id: "cmd:bookmark",
			icon: "\u2606",
			label: "Bookmark Current Page",
			section: "Commands",
		},
		{
			id: "cmd:clear-history",
			icon: "\u2014",
			label: "Clear Browsing History",
			section: "Commands",
		},
	);

	return items;
};
