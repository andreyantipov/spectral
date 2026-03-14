import { canGoBack, canGoForward, currentPage, type Session } from "@ctrl/core.shared";

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
		hasBack: canGoBack(session),
		hasForward: canGoForward(session),
	})) ?? [];
