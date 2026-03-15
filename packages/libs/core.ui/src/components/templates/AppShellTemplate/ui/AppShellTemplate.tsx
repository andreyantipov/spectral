import { createEffect, createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { CommandCenter, type CommandCenterProps } from "../../../organisms/CommandCenter";
import { Notifications } from "../../../organisms/Notifications";
import { Sidebar, type SidebarProps } from "../../../organisms/Sidebar";
import { appShellTemplate } from "./appShellTemplate.style";

type WebviewTagElement = HTMLElement & {
	loadURL: (url: string) => void;
	toggleHidden: (hidden?: boolean) => void;
	togglePassthrough: (passthrough?: boolean) => void;
	syncDimensions: (force?: boolean) => void;
	on: (event: string, handler: (event: CustomEvent) => void) => void;
	off: (event: string, handler: (event: CustomEvent) => void) => void;
};

type IpcBridgeHandle = {
	subscribe: (handler: (cmd: { type: string }) => void) => () => void;
};

// Preload script: forwards Cmd+T, Cmd+K, Cmd+/, Escape from webview tag to host
const SHORTCUT_PRELOAD = `
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 't') {
    e.preventDefault();
    window.__electrobunSendToHost({ type: 'shortcut', key: 'cmd+t' });
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    window.__electrobunSendToHost({ type: 'shortcut', key: 'cmd+k' });
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '/') {
    e.preventDefault();
    window.__electrobunSendToHost({ type: 'shortcut', key: 'cmd+/' });
  }
  if (e.key === 'Escape') {
    window.__electrobunSendToHost({ type: 'shortcut', key: 'escape' });
  }
});
`;

export type AppShellTemplateProps = {
	sidebar: SidebarProps;
	commandCenter: Omit<CommandCenterProps, "open" | "onClose">;
	currentUrl?: string;
	children?: JSX.Element;
};

export function AppShellTemplate(props: AppShellTemplateProps) {
	const $ = appShellTemplate;
	const [ccOpen, setCcOpen] = createSignal(false);
	let webviewRef: WebviewTagElement | undefined;
	let ipcUnsub: (() => void) | undefined;

	function openCc() {
		if (ccOpen()) return;
		setCcOpen(true);
	}

	function closeCc() {
		if (!ccOpen()) return;
		setCcOpen(false);
	}

	function toggleCc() {
		if (ccOpen()) closeCc();
		else openCc();
	}

	function handleNewTab() {
		openCc();
		props.sidebar.onNewTab?.();
	}

	function handleCcSelect(id: string) {
		closeCc();
		props.commandCenter.onSelect?.(id);
	}

	function handleCcSubmitRaw(query: string) {
		closeCc();
		props.commandCenter.onSubmitRaw?.(query);
	}

	// Shortcuts forwarded from webview tag via preload + __electrobunSendToHost
	function handleHostMessage(event: CustomEvent) {
		const msg = event.detail as { type?: string; key?: string } | undefined;
		if (msg?.type === "shortcut") {
			if (msg.key === "cmd+t" || msg.key === "cmd+k" || msg.key === "cmd+/") toggleCc();
			else if (msg.key === "escape" && ccOpen()) closeCc();
		}
	}

	// Cmd+T/Cmd+K/Cmd+/ from host webview DOM (when sidebar or empty area has focus)
	function handleKeyDown(e: KeyboardEvent) {
		if (e.metaKey && (e.key === "t" || e.key === "k" || e.key === "/")) {
			e.preventDefault();
			toggleCc();
		}
		if (e.key === "Escape" && ccOpen()) closeCc();
	}

	onMount(() => {
		document.addEventListener("keydown", handleKeyDown);

		// Subscribe to IPC bridge for Bun process commands (Cmd+K via ApplicationMenu)
		const bridge = (window as unknown as Record<string, unknown>).__ipcBridge as
			| IpcBridgeHandle
			| undefined;
		if (bridge) {
			ipcUnsub = bridge.subscribe((cmd) => {
				if (cmd.type === "toggle-command-center") toggleCc();
			});
		}
	});

	onCleanup(() => {
		document.removeEventListener("keydown", handleKeyDown);
		ipcUnsub?.();
	});

	function setupWebview(el: HTMLElement) {
		webviewRef = el as WebviewTagElement;
		webviewRef.on("host-message", handleHostMessage);
	}

	// Force mask rect sync when CommandCenter opens/closes.
	// The OverlaySyncController only sends masks when the webview position changes.
	// When the CC overlay appears (mask elements change) but the webview hasn't moved,
	// the sync is skipped. Force it so the native CAShapeLayer mask is recalculated.
	createEffect(() => {
		const _open = ccOpen();
		if (webviewRef) {
			requestAnimationFrame(() => webviewRef?.syncDimensions(true));
		}
	});

	createEffect(() => {
		const url = props.currentUrl;
		if (webviewRef && url && url !== "about:blank") {
			webviewRef.loadURL(url);
		}
	});

	return (
		<div class={$().root}>
			<Sidebar {...props.sidebar} onNewTab={handleNewTab} />

			<div class={$().content}>
				<div class={$().page}>
					<Show when={props.currentUrl && props.currentUrl !== "about:blank"}>
						<Dynamic
							component="electrobun-webview"
							ref={setupWebview}
							src={props.currentUrl}
							preload={SHORTCUT_PRELOAD}
							masks="[data-command-center-overlay]"
							style="width: 100%; height: 100%; display: block;"
						/>
					</Show>
					{props.children}
				</div>
			</div>

			<CommandCenter
				{...props.commandCenter}
				open={ccOpen()}
				initialQuery={props.currentUrl}
				onClose={closeCc}
				onSelect={handleCcSelect}
				onSubmitRaw={handleCcSubmitRaw}
			/>

			<Notifications placement="bottom-end" />
		</div>
	);
}
