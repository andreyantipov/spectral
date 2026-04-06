import {
	ActivateSession,
	CloseSession,
	CreateSession,
	Navigate,
	TitleChanged,
	UrlCommitted,
} from "@ctrl/base.op.browsing";
import type { BrowsingState, Session } from "@ctrl/base.schema";
import { withWebTracing } from "@ctrl/base.tracing";
import { currentUrl } from "@ctrl/base.type";
import { DEFAULT_SHORTCUTS, NavigationEvents, SessionEvents } from "@ctrl/arch.contract.event-bus";
import { useApi } from "@ctrl/ui.base.api";
import {
	AppShellTemplate,
	ContextMenu,
	type ContextMenuItem,
	type SidebarItem as CoreSidebarItem,
	type OmniBoxSuggestion,
} from "@ctrl/ui.base.components";
import { createEffect, createMemo, createSignal, type JSX, onCleanup, onMount } from "solid-js";
import { SIDEBAR_FEATURE } from "../lib/constants";
import { buildOmniBoxSuggestions, mapSessionsToSidebarItems } from "../model/sidebar.bindings";

const sidebarTabs: { id: string; icon: JSX.Element; label: string }[] = [];

/** Normalize KeyboardEvent to shortcut string (e.g. "Cmd+T") */
function toShortcutString(e: KeyboardEvent): string {
	const parts: string[] = [];
	if (e.metaKey || e.ctrlKey) parts.push("Cmd");
	if (e.shiftKey) parts.push("Shift");
	if (e.altKey) parts.push("Alt");
	parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
	return parts.join("+");
}

export type WebviewBindings = {
	readonly sessions: () => readonly Session[];
	readonly activeSessionId: () => string;
	readonly activeUrl: () => string | undefined;
	readonly onNavigate: (sessionId: string, url: string) => void;
	readonly onTitleChange: (sessionId: string, title: string) => void;
	readonly createSession: () => void;
	onSplitSession: (sessionId: string, direction: "right" | "down") => void;
};

export type SidebarFeatureProps = {
	children?: JSX.Element | ((bindings: WebviewBindings) => JSX.Element);
};

export function SidebarFeature(props: SidebarFeatureProps) {
	const api = useApi();
	const state = api.state<BrowsingState>("browsing");
	const [omniboxQuery, setOmniboxQuery] = createSignal("");

	let autoCreated = false;
	createEffect(() => {
		const s = state();
		if (s && s.sessions.length === 0 && !autoCreated) {
			autoCreated = true;
			api.dispatchAction(CreateSession.make({ mode: "visual" }));
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

	const resolveUrl = (input: string): string => {
		const trimmed = input.trim();
		if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
		if (/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(trimmed)) return `https://${trimmed}`;
		if (/^localhost(:\d+)?$/.test(trimmed)) return `http://${trimmed}`;
		return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
	};

	const ops = withWebTracing(SIDEBAR_FEATURE, {
		navigate: (input: string) => {
			const session = activeSession();
			if (session) {
				api.dispatchAction(Navigate.make({ instanceId: session.id, url: resolveUrl(input) }));
			}
		},
		createSession: () => api.dispatchAction(CreateSession.make({ mode: "visual" })),
		switchSession: (id: string) => {
			api.dispatchAction(ActivateSession.make({ instanceId: id }));
		},
		closeSession: (id: string) => api.dispatchAction(CloseSession.make({ instanceId: id })),
		reportNavigation: (sessionId: string, url: string) =>
			api.dispatchAction(UrlCommitted.make({ instanceId: sessionId, url, title: "", favicon: "" })),
		updateTitle: (sessionId: string, title: string) =>
			api.dispatchAction(TitleChanged.make({ instanceId: sessionId, title })),
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

	// Actions that need the active session's ID as their payload
	const SESSION_ID_ACTIONS: ReadonlySet<string> = new Set([
		SessionEvents.events["session.close"].tag,
		NavigationEvents.events["nav.back"].tag,
		NavigationEvents.events["nav.forward"].tag,
	]);

	const resolveActivatePayload = (binding: (typeof DEFAULT_SHORTCUTS)[number]) => {
		const idx = Number.parseInt(binding.shortcut.replace("Cmd+", ""), 10) - 1;
		const sessions = state()?.sessions;
		if (!sessions || idx < 0 || idx >= sessions.length) return null;
		return { action: binding.action, payload: { id: sessions[idx].id } };
	};

	const resolveSplitPayload = (binding: (typeof DEFAULT_SHORTCUTS)[number]) => {
		const session = activeSession();
		if (!session) return null;
		const direction = (binding.payload?.direction as "horizontal" | "vertical") ?? "horizontal";
		return {
			action: binding.action,
			payload: {
				panelId: session.id,
				direction,
				newPanel: { id: crypto.randomUUID(), type: "session", sessionId: session.id },
			},
		};
	};

	type Resolved = { action: string; payload: Record<string, unknown> };

	const resolveShortcutPayload = (binding: (typeof DEFAULT_SHORTCUTS)[number]): Resolved | null => {
		if (binding.action === "session.activate") return resolveActivatePayload(binding);
		if (binding.action === "ws.split-panel") return resolveSplitPayload(binding);
		if (SESSION_ID_ACTIONS.has(binding.action)) {
			const session = activeSession();
			return session ? { action: binding.action, payload: { id: session.id } } : null;
		}
		return { action: binding.action, payload: binding.payload ?? {} };
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		const shortcutStr = toShortcutString(e);
		const binding = DEFAULT_SHORTCUTS.find(
			(s) => s.shortcut.toLowerCase() === shortcutStr.toLowerCase(),
		);
		if (!binding) return;
		e.preventDefault();

		const resolved = resolveShortcutPayload(binding);
		if (!resolved) return;
		api.send(resolved.action, resolved.payload);
	};

	// Listen for shortcuts forwarded from native webview via host-message
	onMount(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail as { type?: string; key?: string } | undefined;
			if (detail?.type === "shortcut" && detail.key) {
				const shortcutStr = detail.key
					.split("+")
					.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
					.join("+");
				const binding = DEFAULT_SHORTCUTS.find(
					(s) => s.shortcut.toLowerCase() === shortcutStr.toLowerCase(),
				);
				if (!binding) return;
				const resolved = resolveShortcutPayload(binding);
				if (resolved) api.send(resolved.action, resolved.payload);
			}
		};
		document.addEventListener("webview-host-message", handler);
		onCleanup(() => document.removeEventListener("webview-host-message", handler));
	});

	// Context menu
	const [ctxMenuPos, setCtxMenuPos] = createSignal<{ x: number; y: number } | null>(null);
	const [ctxMenuTarget, setCtxMenuTarget] = createSignal<string | null>(null);

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
			onKeyDown={handleKeyDown}
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
