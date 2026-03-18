import { createEffect, createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
import { OmniBox, type OmniBoxProps, type OmniBoxSuggestion } from "../../../molecules/OmniBox";
import { Notifications } from "../../../organisms/Notifications";
import { Sidebar, type SidebarProps } from "../../../organisms/Sidebar";
import { appShellTemplate } from "./appShellTemplate.style";

type IpcBridgeHandle = {
	subscribe: (handler: (cmd: { type: string }) => void) => () => void;
};

export type AppShellTemplateProps = {
	sidebar: SidebarProps;
	omniBox: Pick<OmniBoxProps, "value" | "suggestions" | "onInput" | "onSubmit">;
	children?: JSX.Element;
};

export function AppShellTemplate(props: AppShellTemplateProps) {
	const $ = appShellTemplate;
	const [omniboxOpen, setOmniboxOpen] = createSignal(false);
	let ipcUnsub: (() => void) | undefined;

	function openOmnibox() {
		if (omniboxOpen()) return;
		setOmniboxOpen(true);
	}

	function closeOmnibox() {
		if (!omniboxOpen()) return;
		setOmniboxOpen(false);
	}

	function toggleOmnibox() {
		if (omniboxOpen()) closeOmnibox();
		else openOmnibox();
	}

	function handleNewSession() {
		openOmnibox();
		props.sidebar.onNewSession?.();
	}

	function handleOmniboxSubmit(value: string, suggestion?: OmniBoxSuggestion) {
		closeOmnibox();
		props.omniBox.onSubmit?.(value, suggestion);
	}

	// Shortcuts forwarded from webview via a bubbling CustomEvent on the root div
	function handleHostMessage(event: Event) {
		const msg = (event as CustomEvent).detail as { type?: string; key?: string } | undefined;
		if (msg?.type === "shortcut") {
			if (msg.key === "cmd+k" || msg.key === "cmd+l") toggleOmnibox();
			else if (msg.key === "escape" && omniboxOpen()) closeOmnibox();
		}
	}

	// Cmd+K / Cmd+L from host webview DOM (when sidebar or empty area has focus)
	function handleKeyDown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "l")) {
			e.preventDefault();
			toggleOmnibox();
		}
		if (e.key === "Escape" && omniboxOpen()) closeOmnibox();
	}

	onMount(() => {
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("webview-host-message", handleHostMessage);

		// Subscribe to IPC bridge for Bun process commands (Cmd+K via ApplicationMenu)
		const bridge = (window as unknown as Record<string, unknown>).__ipcBridge as
			| IpcBridgeHandle
			| undefined;
		if (bridge) {
			ipcUnsub = bridge.subscribe((cmd) => {
				if (cmd.type === "toggle-command-center") toggleOmnibox();
			});
		}
	});

	onCleanup(() => {
		document.removeEventListener("keydown", handleKeyDown);
		document.removeEventListener("webview-host-message", handleHostMessage);
		ipcUnsub?.();
	});

	// Force all webviews to re-sync mask rects when OmniBox opens/closes.
	// The palette DOM element appears/disappears — the native CAShapeLayer must
	// be recalculated to cut a hole where the palette renders.
	createEffect(() => {
		const _open = omniboxOpen();
		// Delay to ensure SolidJS <Show> has flushed the DOM update
		requestAnimationFrame(() => {
			document.querySelectorAll("electrobun-webview").forEach((el) => {
				(el as HTMLElement & { syncDimensions: (force?: boolean) => void }).syncDimensions(true);
			});
		});
	});

	return (
		<div class={$().root}>
			<Sidebar {...props.sidebar} onNewSession={handleNewSession} onHeaderClick={toggleOmnibox} />

			<div class={$().content}>
				<div class={$().page}>{props.children}</div>

				<Show when={omniboxOpen()}>
					<div class={$().omniboxOverlay}>
						<OmniBox {...props.omniBox} onSubmit={handleOmniboxSubmit} onCancel={closeOmnibox} />
					</div>
				</Show>
			</div>

			<Notifications placement="bottom-end" />
		</div>
	);
}
