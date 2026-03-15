import { createEffect, createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { CommandCenter, type CommandCenterProps } from "../../../organisms/CommandCenter";
import { Notifications } from "../../../organisms/Notifications";
import { Sidebar, type SidebarProps } from "../../../organisms/Sidebar";
import { appShellTemplate } from "./appShellTemplate.style";

type WebviewTagElement = HTMLElement & {
	loadURL: (url: string) => void;
	toggleHidden: (hidden?: boolean) => void;
	syncScreenshot: (callback?: () => void) => void;
	clearScreenImage: () => void;
	on: (event: string, handler: (event: CustomEvent) => void) => void;
	off: (event: string, handler: (event: CustomEvent) => void) => void;
};

// Preload script injected into the webview tag to forward shortcuts to host
const SHORTCUT_PRELOAD = `
document.addEventListener('keydown', function(e) {
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

	function openCc() {
		if (ccOpen()) return;
		// Screenshot the page, then hide native view so CommandCenter renders on top
		if (webviewRef) {
			webviewRef.syncScreenshot(() => {
				webviewRef?.toggleHidden(true);
			});
		}
		setCcOpen(true);
	}

	function closeCc() {
		if (!ccOpen()) return;
		setCcOpen(false);
		// Restore native view and clean up screenshot
		if (webviewRef) {
			webviewRef.toggleHidden(false);
			webviewRef.clearScreenImage();
		}
	}

	function toggleCc() {
		if (ccOpen()) {
			closeCc();
		} else {
			openCc();
		}
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

	// Handle shortcuts forwarded from webview tag via preload + host-message
	function handleHostMessage(event: CustomEvent) {
		const msg = event.detail as { type?: string; key?: string } | undefined;
		if (msg?.type === "shortcut") {
			if (msg.key === "cmd+k" || msg.key === "cmd+/") {
				toggleCc();
			} else if (msg.key === "escape" && ccOpen()) {
				closeCc();
			}
		}
	}

	// Handle Cmd+K from host webview DOM (when webview tag doesn't have focus)
	function handleKeyDown(e: KeyboardEvent) {
		if (e.metaKey && (e.key === "k" || e.key === "/")) {
			e.preventDefault();
			toggleCc();
		}
		if (e.key === "Escape" && ccOpen()) {
			closeCc();
		}
	}

	// Handle Cmd+K from Bun process (via ApplicationMenu accelerator)
	function handleGlobalToggle() {
		toggleCc();
	}

	onMount(() => {
		// Bun process sends toggle via executeJavascript → window global
		(window as unknown as Record<string, unknown>).__ctrlToggleCommandCenter = handleGlobalToggle;
		document.addEventListener("keydown", handleKeyDown);
	});

	onCleanup(() => {
		delete (window as unknown as Record<string, unknown>).__ctrlToggleCommandCenter;
		document.removeEventListener("keydown", handleKeyDown);
	});

	// Wire webview ref: load URL on change + listen for host-message
	function setupWebview(el: HTMLElement) {
		webviewRef = el as WebviewTagElement;
		webviewRef.on("host-message", handleHostMessage);
	}

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
							sandbox=""
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
