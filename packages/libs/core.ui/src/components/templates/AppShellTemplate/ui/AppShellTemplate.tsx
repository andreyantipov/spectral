import { createSignal, type JSX, onCleanup, onMount } from "solid-js";
import { CommandCenter, type CommandCenterProps } from "../../../organisms/CommandCenter";
import { Sidebar, type SidebarProps } from "../../../organisms/Sidebar";
import { appShellTemplate } from "./appShellTemplate.style";

export type AppShellTemplateProps = {
	sidebar: SidebarProps;
	commandCenter: Omit<CommandCenterProps, "open" | "onClose">;
	currentUrl?: string;
	onOverlayToggle?: (visible: boolean) => void;
	children?: JSX.Element;
};

export function AppShellTemplate(props: AppShellTemplateProps) {
	const $ = appShellTemplate;
	const [ccOpen, setCcOpen] = createSignal(false);

	function handleNewTab() {
		setCcOpen(true);
		props.onOverlayToggle?.(true);
		props.sidebar.onNewTab?.();
	}

	function handleCcClose() {
		setCcOpen(false);
		props.onOverlayToggle?.(false);
	}

	function handleCcSelect(id: string) {
		setCcOpen(false);
		props.commandCenter.onSelect?.(id);
	}

	function handleCcSubmitRaw(query: string) {
		setCcOpen(false);
		props.commandCenter.onSubmitRaw?.(query);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.metaKey && e.key === "k") {
			e.preventDefault();
			const next = !ccOpen();
			setCcOpen(next);
			props.onOverlayToggle?.(next);
		}
	}

	onMount(() => {
		document.addEventListener("keydown", handleKeyDown);
	});

	onCleanup(() => {
		document.removeEventListener("keydown", handleKeyDown);
	});

	return (
		<div class={$().root}>
			<Sidebar {...props.sidebar} onNewTab={handleNewTab} />

			<div class={$().content}>
				<div class={$().page}>{props.children}</div>
			</div>

			<CommandCenter
				{...props.commandCenter}
				open={ccOpen()}
				initialQuery={props.currentUrl}
				onClose={handleCcClose}
				onSelect={handleCcSelect}
				onSubmitRaw={handleCcSubmitRaw}
			/>
		</div>
	);
}
