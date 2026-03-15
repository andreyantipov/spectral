import { createEffect, createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { CommandCenter, type CommandCenterProps } from "../../../organisms/CommandCenter";
import { Sidebar, type SidebarProps } from "../../../organisms/Sidebar";
import { appShellTemplate } from "./appShellTemplate.style";

export type AppShellTemplateProps = {
	sidebar: SidebarProps;
	commandCenter: Omit<CommandCenterProps, "open" | "onClose">;
	currentUrl?: string;
	children?: JSX.Element;
};

export function AppShellTemplate(props: AppShellTemplateProps) {
	const $ = appShellTemplate;
	const [ccOpen, setCcOpen] = createSignal(false);
	let webviewRef: HTMLElement | undefined;

	function openCc() {
		setCcOpen(true);
	}

	function closeCc() {
		setCcOpen(false);
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

	function handleKeyDown(e: KeyboardEvent) {
		if (e.metaKey && e.key === "k") {
			e.preventDefault();
			if (ccOpen()) {
				closeCc();
			} else {
				openCc();
			}
		}
	}

	onMount(() => {
		document.addEventListener("keydown", handleKeyDown);
	});

	onCleanup(() => {
		document.removeEventListener("keydown", handleKeyDown);
	});

	createEffect(() => {
		const url = props.currentUrl;
		if (webviewRef && url && url !== "about:blank") {
			(webviewRef as unknown as { loadURL: (url: string) => void }).loadURL(url);
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
							ref={(el: HTMLElement) => {
								webviewRef = el;
							}}
							src={props.currentUrl}
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
		</div>
	);
}
