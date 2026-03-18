import { currentUrl } from "@ctrl/core.shared";
import {
	AppShellTemplate,
	type SidebarItem as CoreSidebarItem,
	type OmniBoxSuggestion,
	useRuntime,
} from "@ctrl/core.ui";
import { createMemo, createSignal, type JSX } from "solid-js";
import { useBrowsingRpc } from "../api/use-sidebar";
import { buildOmniBoxSuggestions, mapSessionsToSidebarItems } from "../model/sidebar.bindings";

// No tabs = no rail. Sessions is the only section, rail serves no purpose.
const sidebarTabs: { id: string; icon: JSX.Element; label: string }[] = [];

export type WebviewBindings = {
	readonly activeSessionId: () => string;
	readonly activeUrl: () => string | undefined;
	readonly onNavigate: (url: string) => void;
	readonly onTitleChange: (title: string) => void;
};

export type SidebarFeatureProps = {
	children?: JSX.Element | ((bindings: WebviewBindings) => JSX.Element);
};

export function SidebarFeature(props: SidebarFeatureProps) {
	const { client, state } = useBrowsingRpc();
	const runtime = useRuntime();
	const [omniboxQuery, setOmniboxQuery] = createSignal("");

	const mappedSessions = createMemo(() => mapSessionsToSidebarItems(state()?.sessions));

	const items = (): CoreSidebarItem[] =>
		mappedSessions().map((item) => ({
			id: item.id,
			label: item.label,
		}));

	const activeItemId = () => mappedSessions().find((item) => item.active)?.id ?? null;

	const activeSession = () => state()?.sessions?.find((s) => s.isActive);

	const navigateActiveSession = (input: string) => {
		const session = activeSession();
		if (session) {
			void runtime.runPromise(client.navigate({ id: session.id, input }));
		}
	};

	const handleNewSession = () => {
		void runtime.runPromise(client.createSession({ mode: "visual" }));
	};

	const handleItemClick = (id: string) => {
		void runtime.runPromise(client.setActive({ id }));
	};

	const handleItemClose = (id: string) => {
		void runtime.runPromise(client.removeSession({ id }));
	};

	const activeUrl = () => {
		const session = activeSession();
		return session ? currentUrl(session) : undefined;
	};

	const omniboxSuggestions = createMemo(() => buildOmniBoxSuggestions(state(), omniboxQuery()));

	const handleOmniboxInput = (value: string) => {
		setOmniboxQuery(value);
	};

	const handleOmniboxSubmit = (value: string, _suggestion?: OmniBoxSuggestion) => {
		setOmniboxQuery("");
		navigateActiveSession(value);
	};

	const headerInput = () => (
		<button
			type="button"
			onClick={() => {
				// Toggle the omnibox overlay (Cmd+K behavior)
				const event = new KeyboardEvent("keydown", {
					key: "k",
					metaKey: true,
					bubbles: true,
				});
				document.dispatchEvent(event);
			}}
			style={{
				flex: "1",
				background: "rgba(255,255,255,0.06)",
				border: "1px solid rgba(255,255,255,0.1)",
				"border-radius": "6px",
				color: "rgba(255,255,255,0.5)",
				"font-size": "12px",
				padding: "4px 8px",
				cursor: "pointer",
				"text-align": "left",
				"min-width": "0",
				overflow: "hidden",
				"text-overflow": "ellipsis",
				"white-space": "nowrap",
			}}
			title="Search or enter URL (⌘K)"
		>
			{activeUrl() ?? "Search or enter URL..."}
		</button>
	);

	const webviewBindings: WebviewBindings = {
		activeSessionId: () => activeSession()?.id ?? "",
		activeUrl,
		onNavigate: (url: string) => {
			const session = activeSession();
			if (session) {
				void runtime.runPromise(client.reportNavigation({ id: session.id, url }));
			}
		},
		onTitleChange: (title: string) => {
			const session = activeSession();
			if (session) {
				void runtime.runPromise(client.updateTitle({ id: session.id, title }));
			}
		},
	};

	const content = () => {
		const c = props.children;
		return typeof c === "function"
			? (c as (bindings: WebviewBindings) => JSX.Element)(webviewBindings)
			: c;
	};

	return (
		<AppShellTemplate
			sidebar={{
				tabs: sidebarTabs,
				activeTabId: "sessions",
				headerContent: headerInput(),
				items: items(),
				activeItemId: activeItemId(),
				onNewSession: handleNewSession,
				onItemClick: handleItemClick,
				onItemClose: handleItemClose,
			}}
			omniBox={{
				value: activeUrl(),
				suggestions: omniboxSuggestions(),
				onInput: handleOmniboxInput,
				onSubmit: handleOmniboxSubmit,
			}}
		>
			{content()}
		</AppShellTemplate>
	);
}
