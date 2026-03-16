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
	addMaskSelector: (selector: string) => void;
	removeMaskSelector: (selector: string) => void;
	on: (event: string, handler: (event: CustomEvent) => void) => void;
	off: (event: string, handler: (event: CustomEvent) => void) => void;
};

type IpcBridgeHandle = {
	subscribe: (handler: (cmd: { type: string }) => void) => () => void;
};

// Preload script: forwards Cmd+K, Escape from webview tag to host
const SHORTCUT_PRELOAD = `
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    window.__electrobunSendToHost({ type: 'shortcut', key: 'cmd+k' });
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
			if (msg.key === "cmd+k") toggleCc();
			else if (msg.key === "escape" && ccOpen()) closeCc();
		}
	}

	// Cmd+K from host webview DOM (when sidebar or empty area has focus)
	function handleKeyDown(e: KeyboardEvent) {
		if (e.metaKey && e.key === "k") {
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
		// Register mask selector programmatically — SolidJS sets custom element
		// props as JS properties, not HTML attributes. The Electrobun custom element
		// reads masks via getAttribute() which misses property-only values.
		// addMaskSelector() writes to the internal maskSelectors Set directly.
		webviewRef.addMaskSelector("[data-command-center-overlay]");
	}

	// Force all webviews to re-sync mask rects when CommandCenter opens/closes.
	// The palette DOM element appears/disappears — the native CAShapeLayer must
	// be recalculated to cut a hole where the palette renders.
	createEffect(() => {
		const _open = ccOpen();
		// Delay to ensure SolidJS <Show> has flushed the DOM update
		requestAnimationFrame(() => {
			document.querySelectorAll("electrobun-webview").forEach((el) => {
				(el as WebviewTagElement).syncDimensions(true);
			});
		});
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
							style={`width: 100%; height: 100%; display: block; background: ${ccOpen() ? "transparent" : "#fff"}; border-radius: ${ccOpen() ? "8px" : "0"};`}
						/>
					</Show>
					{props.children}
				</div>

				<CommandCenter
					{...props.commandCenter}
					open={ccOpen()}
					initialQuery={props.currentUrl}
					onClose={closeCc}
					onSelect={handleCcSelect}
					onSubmitRaw={handleCcSubmitRaw}
				/>
			</div>

			<Notifications placement="bottom-end" />
		</div>
	);
}
