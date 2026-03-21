import { type BrowsingState, currentPage, type Session } from "@ctrl/core.shared";
import type { CommandCenterItem, OmniBoxSuggestion } from "@ctrl/core.ui";

export type SidebarItem = {
	readonly id: string;
	readonly label: string;
	readonly active: boolean;
	readonly hasBack: boolean;
	readonly hasForward: boolean;
	readonly faviconUrl: string | null;
};

const safeHostname = (url: string): string => {
	try {
		return new URL(url).hostname || url;
	} catch {
		return url;
	}
};

const displayLabel = (session: Session): string => {
	const page = currentPage(session);
	if (!page || page.url === "about:blank") return "New Tab";
	if (page.title) return page.title;
	return safeHostname(page.url);
};

const faviconUrl = (session: Session): string | null => {
	const page = currentPage(session);
	if (!page || page.url === "about:blank") return null;
	try {
		const origin = new URL(page.url).origin;
		return `${origin}/favicon.ico`;
	} catch {
		return null;
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
		faviconUrl: faviconUrl(session),
	})) ?? [];

export const buildOmniBoxSuggestions = (
	state: BrowsingState | undefined,
	query: string,
): OmniBoxSuggestion[] => {
	const q = query.trim().toLowerCase();
	const suggestions: OmniBoxSuggestion[] = [];

	for (const session of state?.sessions ?? []) {
		const page = currentPage(session);
		if (!page) continue;
		const label = page.title ?? safeHostname(page.url);
		if (q && !label.toLowerCase().includes(q) && !page.url.toLowerCase().includes(q)) continue;
		suggestions.push({ type: "tab", text: label, url: page.url, action: "Switch" });
	}

	for (const bookmark of state?.bookmarks ?? []) {
		const label = bookmark.title ?? bookmark.url;
		if (q && !label.toLowerCase().includes(q) && !bookmark.url.toLowerCase().includes(q)) continue;
		suggestions.push({ type: "bookmark", text: label, url: bookmark.url });
	}

	return suggestions;
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
