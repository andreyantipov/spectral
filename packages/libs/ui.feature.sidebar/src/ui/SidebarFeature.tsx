import { currentUrl } from "@ctrl/core.shared";
import {
	AppShellTemplate,
	type SidebarItem as CoreSidebarItem,
	type OmniBoxSuggestion,
	useRuntime,
} from "@ctrl/core.ui";
import type { JSX } from "solid-js";
import { createMemo, createSignal } from "solid-js";
import { useBrowsingRpc } from "../api/use-sidebar";
import { buildOmniBoxSuggestions, mapSessionsToSidebarItems } from "../model/sidebar.bindings";

const sidebarTabs = [
	{ id: "sessions", icon: (<span>{"\u2630"}</span>) as JSX.Element, label: "Sessions" },
];

export type SidebarFeatureProps = {
	children?: JSX.Element;
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

	return (
		<AppShellTemplate
			sidebar={{
				tabs: sidebarTabs,
				activeTabId: "sessions",
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
			currentUrl={activeUrl()}
		>
			{props.children}
		</AppShellTemplate>
	);
}
