import { createEffect, createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
import { OmniBox, type OmniBoxProps, type OmniBoxSuggestion } from "../../../molecules/OmniBox";
import { Notifications } from "../../../organisms/Notifications";
import { Sidebar, type SidebarProps } from "../../../organisms/Sidebar";
import { appShellTemplate } from "./appShellTemplate.style";

export type AppShellTemplateProps = {
	sidebar: SidebarProps;
	omniBox: Pick<OmniBoxProps, "value" | "suggestions" | "onInput" | "onSubmit">;
	onKeyDown?: (e: KeyboardEvent) => void;
	children?: JSX.Element;
};

export function AppShellTemplate(props: AppShellTemplateProps) {
	const $ = appShellTemplate;
	const [omniboxOpen, setOmniboxOpen] = createSignal(false);

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
		const result = props.sidebar.onNewSession?.();
		if (result && typeof (result as Promise<unknown>).then === "function") {
			(result as Promise<unknown>).then(() => requestAnimationFrame(() => openOmnibox()));
		} else {
			requestAnimationFrame(() => openOmnibox());
		}
	}

	function handleOmniboxSubmit(value: string, suggestion?: OmniBoxSuggestion) {
		closeOmnibox();
		props.omniBox.onSubmit?.(value, suggestion);
	}

	function handleHostMessage(event: Event) {
		const msg = (event as CustomEvent).detail as { type?: string; key?: string } | undefined;
		if (msg?.type === "shortcut") {
			if (msg.key === "cmd+k" || msg.key === "cmd+l") toggleOmnibox();
			else if (msg.key === "escape" && omniboxOpen()) closeOmnibox();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		// Delegate shortcut dispatch to parent
		props.onKeyDown?.(e);

		// Omnibox toggle (Cmd+K, Cmd+L)
		if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "l")) {
			e.preventDefault();
			toggleOmnibox();
		}
		if (e.key === "Escape" && omniboxOpen()) closeOmnibox();
	}

	onMount(() => {
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("webview-host-message", handleHostMessage);
	});

	onCleanup(() => {
		document.removeEventListener("keydown", handleKeyDown);
		document.removeEventListener("webview-host-message", handleHostMessage);
	});

	createEffect(() => {
		const _open = omniboxOpen();
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
