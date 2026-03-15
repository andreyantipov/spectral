import { createSignal, type JSX, onCleanup, onMount } from "solid-js";
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

	function handleNewTab() {
		setCcOpen(true);
		props.sidebar.onNewTab?.();
	}

	function handleCcClose() {
		setCcOpen(false);
	}

	function handleCcSelect(id: string) {
		setCcOpen(false);
		props.commandCenter.onSelect?.(id);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.metaKey && e.key === "k") {
			e.preventDefault();
			setCcOpen((prev) => !prev);
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
			/>
		</div>
	);
}
