import { For, Show } from "solid-js";
import { tabBar } from "./tab-bar.style";

export type TabData = {
	id: number;
	url: string;
	title: string;
	isActive: number;
};

export type TabBarProps = {
	tabs: TabData[];
	activeTabId: number | null;
	onTabClick: (id: number) => void;
	onTabClose: (id: number) => void;
	onNewTab: () => void;
};

function hostnameFromUrl(url: string): string {
	try {
		const u = new URL(url);
		return u.hostname || url;
	} catch {
		return url || "New Tab";
	}
}

export function TabBar(props: TabBarProps) {
	const $ = tabBar();
	const $active = tabBar({ active: true });

	return (
		<div class={$.root}>
			<For each={props.tabs}>
				{(t) => {
					const s = () => (t.id === props.activeTabId ? $active : $);
					return (
						<button type="button" class={s().tab} onClick={() => props.onTabClick(t.id)}>
							<span class={s().tabTitle}>
								{t.title !== "New Tab" ? t.title : hostnameFromUrl(t.url)}
							</span>
							<Show when={props.tabs.length > 1}>
								<button
									type="button"
									class={s().closeButton}
									onClick={(e) => {
										e.stopPropagation();
										props.onTabClose(t.id);
									}}
								>
									&times;
								</button>
							</Show>
						</button>
					);
				}}
			</For>
			<button type="button" class={$.newTabButton} onClick={() => props.onNewTab()}>
				+
			</button>
		</div>
	);
}
