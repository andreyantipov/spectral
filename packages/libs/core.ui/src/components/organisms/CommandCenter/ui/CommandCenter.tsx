import { createEffect, createSignal, For, type JSX, onCleanup, onMount, Show } from "solid-js";
import { commandCenter } from "./commandCenter.style";

export type CommandCenterItem = {
	id: string;
	icon?: JSX.Element;
	label: string;
	secondaryLabel?: string;
	section?: string;
	badge?: string;
};

export type CommandCenterProps = {
	open: boolean;
	items: CommandCenterItem[];
	placeholder?: string;
	initialQuery?: string;
	onSelect?: (id: string) => void;
	onSubmitRaw?: (query: string) => void;
	onClose?: () => void;
};

export function CommandCenter(props: CommandCenterProps) {
	const $ = commandCenter;
	const $active = () => commandCenter({ activeItem: true });

	const [query, setQuery] = createSignal("");
	const [activeIndex, setActiveIndex] = createSignal(0);

	// Pre-fill query when opened with initialQuery (e.g. current URL)
	createEffect(() => {
		if (props.open) {
			setQuery(props.initialQuery ?? "");
			setActiveIndex(0);
		}
	});

	const filteredItems = () => {
		const q = query().toLowerCase();
		if (!q) return props.items;
		return props.items.filter(
			(item) =>
				item.label.toLowerCase().includes(q) ||
				item.secondaryLabel?.toLowerCase().includes(q) ||
				item.section?.toLowerCase().includes(q),
		);
	};

	const sections = () => {
		const items = filteredItems();
		const grouped = new Map<string, CommandCenterItem[]>();
		for (const item of items) {
			const section = item.section ?? "";
			const list = grouped.get(section) ?? [];
			list.push(item);
			grouped.set(section, list);
		}
		return grouped;
	};

	function onKeyDown(e: KeyboardEvent) {
		const items = filteredItems();
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, items.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const item = items[activeIndex()];
			if (item) {
				props.onSelect?.(item.id);
			} else if (query().trim()) {
				props.onSubmitRaw?.(query().trim());
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			props.onClose?.();
		}
	}

	onMount(() => {
		document.addEventListener("keydown", onKeyDown);
	});

	onCleanup(() => {
		document.removeEventListener("keydown", onKeyDown);
	});

	let flatIndex = 0;

	return (
		<Show when={props.open}>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: overlay dismisses on click, Escape handled by keydown listener */}
			<div class={$().overlay} role="presentation" onClick={() => props.onClose?.()}>
				{/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: dialog stops click propagation */}
				<div class={$().palette} role="dialog" onClick={(e) => e.stopPropagation()}>
					<div class={$().searchBar}>
						<span class={$().searchIcon}>&#8981;</span>
						<input
							class={$().searchInput}
							placeholder={props.placeholder ?? "Search or type a command..."}
							value={query()}
							onInput={(e) => {
								setQuery(e.currentTarget.value);
								setActiveIndex(0);
							}}
							autofocus
						/>
						<span class={$().shortcutBadge}>⌘K</span>
					</div>

					<div class={$().divider} />

					<div class={$().results}>
						{(() => {
							flatIndex = 0;
							return null;
						})()}
						<For each={[...sections().entries()]}>
							{([section, items]) => (
								<>
									<Show when={section}>
										<span class={$().sectionLabel}>{section}</span>
									</Show>
									<For each={items}>
										{(item) => {
											const idx = flatIndex++;
											const s = () => (idx === activeIndex() ? $active() : $());
											return (
												<button
													type="button"
													class={s().resultItem}
													onClick={() => props.onSelect?.(item.id)}
													onMouseEnter={() => setActiveIndex(idx)}
												>
													<Show when={item.icon}>
														<span class={s().resultIcon}>{item.icon}</span>
													</Show>
													<span class={s().resultLabel}>{item.label}</span>
													<Show when={item.secondaryLabel}>
														<span class={s().resultSecondary}>{item.secondaryLabel}</span>
													</Show>
													<Show when={item.badge}>
														<span class={s().resultBadge}>
															{item.badge}
															<span class={s().resultBadgeIcon}>→</span>
														</span>
													</Show>
												</button>
											);
										}}
									</For>
								</>
							)}
						</For>
					</div>

					<div class={$().divider} />

					<div class={$().footer}>
						<span class={$().footerHint}>
							<span class={$().footerHintKey}>↑↓</span>
							<span class={$().footerHintLabel}>navigate</span>
						</span>
						<span class={$().footerHint}>
							<span class={$().footerHintKey}>↵</span>
							<span class={$().footerHintLabel}>open</span>
						</span>
						<span class={$().footerHint}>
							<span class={$().footerHintKey}>esc</span>
							<span class={$().footerHintLabel}>dismiss</span>
						</span>
					</div>
				</div>
			</div>
		</Show>
	);
}
