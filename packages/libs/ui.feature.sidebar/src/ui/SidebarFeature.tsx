import type { Session } from "@ctrl/core.base.model";
import { withWebTracing } from "@ctrl/core.base.tracing";
import { currentUrl } from "@ctrl/core.base.types";
import {
	AppShellTemplate,
	ContextMenu,
	type ContextMenuItem,
	type SidebarItem as CoreSidebarItem,
	type OmniBoxSuggestion,
	useRuntime,
} from "@ctrl/core.ui";
import { createEffect, createMemo, createSignal, type JSX } from "solid-js";
import { useBrowsingRpc } from "../api/use-sidebar";
import { SIDEBAR_FEATURE } from "../lib/constants";
import { buildOmniBoxSuggestions, mapSessionsToSidebarItems } from "../model/sidebar.bindings";

// No tabs = no rail. Sessions is the only section, rail serves no purpose.
const sidebarTabs: { id: string; icon: JSX.Element; label: string }[] = [];

export type WebviewBindings = {
	readonly sessions: () => readonly Session[];
	readonly activeSessionId: () => string;
	readonly activeUrl: () => string | undefined;
	readonly onNavigate: (sessionId: string, url: string) => void;
	readonly onTitleChange: (sessionId: string, title: string) => void;
	readonly createSession: () => Promise<unknown>;
	onSplitSession: (sessionId: string, direction: "right" | "down") => void;
};

export type SidebarFeatureProps = {
	children?: JSX.Element | ((bindings: WebviewBindings) => JSX.Element);
};

export function SidebarFeature(props: SidebarFeatureProps) {
	const { client, state } = useBrowsingRpc();
	const runtime = useRuntime();
	const [omniboxQuery, setOmniboxQuery] = createSignal("");

	// Auto-create first session if none exist (guard prevents multiple creates)
	let autoCreated = false;
	createEffect(() => {
		const s = state();
		if (s && s.sessions.length === 0 && !autoCreated) {
			autoCreated = true;
			ops.createSession();
		}
	});

	const mappedSessions = createMemo(() => mapSessionsToSidebarItems(state()?.sessions));

	const items = (): CoreSidebarItem[] =>
		mappedSessions().map((item) => ({
			id: item.id,
			label: item.label,
			icon: item.faviconUrl ? (
				<img
					src={item.faviconUrl}
					alt=""
					width={16}
					height={16}
					style={{ "border-radius": "2px" }}
					onError={(e) => {
						(e.currentTarget as HTMLImageElement).style.display = "none";
					}}
				/>
			) : undefined,
		}));

	const activeItemId = () => mappedSessions().find((item) => item.active)?.id ?? null;

	const activeSession = () => state()?.sessions?.find((s) => s.isActive);

	const ops = withWebTracing(SIDEBAR_FEATURE, {
		navigate: (input: string) => {
			const session = activeSession();
			if (session) {
				void runtime.runPromise(client.navigate({ id: session.id, input }));
			}
		},
		createSession: () => runtime.runPromise(client.createSession({ mode: "visual" })),
		switchSession: (id: string) => {
			void runtime.runPromise(client.setActive({ id }));
		},
		closeSession: (id: string) => {
			void runtime.runPromise(client.removeSession({ id }));
		},
		reportNavigation: (sessionId: string, url: string) => {
			void runtime.runPromise(client.reportNavigation({ id: sessionId, url }));
		},
		updateTitle: (sessionId: string, title: string) => {
			void runtime.runPromise(client.updateTitle({ id: sessionId, title }));
		},
	});

	const activeUrl = () => {
		const session = activeSession();
		if (!session) return undefined;
		const url = currentUrl(session);
		return url && url !== "about:blank" ? url : undefined;
	};

	const omniboxSuggestions = createMemo(() => buildOmniBoxSuggestions(state(), omniboxQuery()));

	const handleOmniboxSubmit = (value: string, _suggestion?: OmniBoxSuggestion) => {
		setOmniboxQuery("");
		ops.navigate(value);
	};

	const headerInput = () => activeUrl() ?? "Search or enter URL...";

	// Context menu for tab right-click
	const [ctxMenuPos, setCtxMenuPos] = createSignal<{ x: number; y: number } | null>(null);
	const [ctxMenuTarget, setCtxMenuTarget] = createSignal<string | null>(null);

	// Sync webview masks when context menu opens/closes
	createEffect(() => {
		const _pos = ctxMenuPos();
		requestAnimationFrame(() => {
			document.querySelectorAll("electrobun-webview").forEach((el) => {
				(el as HTMLElement & { syncDimensions: (f?: boolean) => void }).syncDimensions(true);
			});
		});
	});

	const ctxMenuItems: ContextMenuItem[] = [
		{ id: "split-right", label: "Split Right" },
		{ id: "split-down", label: "Split Down" },
		{ id: "divider", label: "", divider: true },
		{ id: "close", label: "Close Tab" },
	];

	// splitSession callback — set by MainScene via bindings
	let splitHandler: ((sessionId: string, direction: "right" | "down") => void) | undefined;

	const webviewBindings: WebviewBindings = {
		sessions: () => state()?.sessions ?? [],
		activeSessionId: () => activeSession()?.id ?? "",
		activeUrl,
		onNavigate: (sessionId: string, url: string) => ops.reportNavigation(sessionId, url),
		onTitleChange: (sessionId: string, title: string) => ops.updateTitle(sessionId, title),
		createSession: () => ops.createSession(),
		onSplitSession: (sessionId: string, direction: "right" | "down") => {
			splitHandler?.(sessionId, direction);
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
				onNewSession: ops.createSession,
				onItemClick: ops.switchSession,
				onItemClose: ops.closeSession,
				onItemContextMenu: (id: string, e: MouseEvent) => {
					setCtxMenuTarget(id);
					// Position menu at click Y but push X past sidebar to avoid clipping
					const sidebarEl = (e.currentTarget as HTMLElement).closest("[data-sidebar]");
					const sidebarRight = sidebarEl ? sidebarEl.getBoundingClientRect().right : e.clientX;
					setCtxMenuPos({ x: Math.max(e.clientX, sidebarRight + 4), y: e.clientY });
				},
			}}
			omniBox={{
				value: activeUrl(),
				suggestions: omniboxSuggestions(),
				onInput: setOmniboxQuery,
				onSubmit: handleOmniboxSubmit,
			}}
		>
			{content()}
			<ContextMenu
				items={ctxMenuItems}
				position={ctxMenuPos()}
				onClose={() => setCtxMenuPos(null)}
				onSelect={(action) => {
					const target = ctxMenuTarget();
					setCtxMenuPos(null);
					if (!target) return;
					if (action === "split-right") {
						webviewBindings.onSplitSession(target, "right");
					} else if (action === "split-down") {
						webviewBindings.onSplitSession(target, "down");
					} else if (action === "close") {
						ops.closeSession(target);
					}
				}}
			/>
		</AppShellTemplate>
	);
}
