import { currentPage, currentUrl } from "@ctrl/core.shared";
import { AppShellTemplate, type SidebarItem as CoreSidebarItem, useRuntime } from "@ctrl/core.ui";
import type { JSX } from "solid-js";
import { useBrowsingRpc } from "../api/use-sidebar";
import { buildCommandCenterItems, mapSessionsToSidebarItems } from "../model/sidebar.bindings";

const sidebarTabs = [
	{ id: "sessions", icon: (<span>{"\u2630"}</span>) as JSX.Element, label: "Sessions" },
	{ id: "bookmarks", icon: (<span>{"\u2606"}</span>) as JSX.Element, label: "Bookmarks" },
	{ id: "history", icon: (<span>{"\u21BB"}</span>) as JSX.Element, label: "History" },
];

const looksLikeUrl = (query: string): boolean =>
	query.includes(".") || query.startsWith("http://") || query.startsWith("https://");

const normalizeUrl = (query: string): string =>
	query.startsWith("http://") || query.startsWith("https://") ? query : `https://${query}`;

export type SidebarFeatureProps = {
	children?: JSX.Element;
};

export function SidebarFeature(props: SidebarFeatureProps) {
	const { client, state } = useBrowsingRpc();
	const runtime = useRuntime();

	const items = (): CoreSidebarItem[] =>
		mapSessionsToSidebarItems(state()?.sessions).map((item) => ({
			id: item.id,
			label: item.label,
		}));

	const activeItemId = () =>
		mapSessionsToSidebarItems(state()?.sessions).find((item) => item.active)?.id ?? null;

	const activeSession = () => state()?.sessions?.find((s) => s.isActive);

	const navigateActiveSession = (url: string) => {
		const session = activeSession();
		if (session) {
			void runtime.runPromise(client.navigate({ id: session.id, url }));
		}
	};

	const handleNewTab = () => {
		void runtime.runPromise(client.createSession({ mode: "visual" }));
	};

	const handleItemClick = (id: string) => {
		void runtime.runPromise(client.setActive({ id }));
	};

	const handleItemClose = (id: string) => {
		void runtime.runPromise(client.removeSession({ id }));
	};

	const handleSessionSelect = (id: string) => {
		const sessionId = id.slice("session:".length);
		void runtime.runPromise(client.setActive({ id: sessionId }));
	};

	const handleBookmarkSelect = (id: string) => {
		const bookmark = state()?.bookmarks?.find((b) => b.id === id.slice("bookmark:".length));
		if (bookmark) navigateActiveSession(bookmark.url);
	};

	const handleBookmarkCommand = () => {
		const session = activeSession();
		if (!session) return;
		const page = currentPage(session);
		if (page) {
			void runtime.runPromise(client.addBookmark({ url: page.url, title: page.title }));
		}
	};

	const handleCcSelect = (id: string) => {
		if (id.startsWith("session:")) return handleSessionSelect(id);
		if (id.startsWith("bookmark:")) return handleBookmarkSelect(id);
		if (id === "cmd:new-tab") return handleNewTab();
		if (id === "cmd:bookmark") return handleBookmarkCommand();
		if (id === "cmd:clear-history") {
			void runtime.runPromise(client.clearHistory());
			return;
		}
		if (looksLikeUrl(id)) navigateActiveSession(normalizeUrl(id));
	};

	const handleSubmitRaw = (query: string) => {
		if (looksLikeUrl(query)) {
			navigateActiveSession(normalizeUrl(query));
		}
	};

	const activeUrl = () => {
		const session = activeSession();
		return session ? currentUrl(session) : undefined;
	};

	return (
		<AppShellTemplate
			sidebar={{
				tabs: sidebarTabs,
				activeTabId: "sessions",
				items: items(),
				activeItemId: activeItemId(),
				onNewTab: handleNewTab,
				onItemClick: handleItemClick,
				onItemClose: handleItemClose,
			}}
			commandCenter={{
				items: buildCommandCenterItems(state()),
				onSelect: handleCcSelect,
				onSubmitRaw: handleSubmitRaw,
			}}
			currentUrl={activeUrl()}
		>
			{props.children}
		</AppShellTemplate>
	);
}
