import { createEffect, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { contextMenu } from "./contextMenu.style";

export type ContextMenuItem = {
	id: string;
	label: string;
	icon?: JSX.Element;
	shortcut?: string;
	divider?: boolean;
};

export type ContextMenuProps = {
	items: ContextMenuItem[];
	position: { x: number; y: number } | null;
	onSelect: (id: string) => void;
	onClose: () => void;
};

export function ContextMenu(props: ContextMenuProps) {
	const $ = contextMenu();
	const [activeIndex, setActiveIndex] = createSignal(-1);
	let rootRef: HTMLDivElement | undefined;

	const selectableItems = () => props.items.filter((item) => !item.divider);

	const clampedPosition = () => {
		const pos = props.position;
		if (!pos) return { x: 0, y: 0 };

		const menuWidth = 220;
		const menuHeight = props.items.length * 32 + 8;
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		return {
			x: Math.min(pos.x, vw - menuWidth),
			y: Math.min(pos.y, vh - menuHeight),
		};
	};

	function handleKeyDown(e: KeyboardEvent) {
		if (!props.position) return;
		const items = selectableItems();
		const len = items.length;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, len - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const idx = activeIndex();
			if (idx >= 0 && idx < len) {
				props.onSelect(items[idx].id);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			props.onClose();
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (rootRef && !rootRef.contains(e.target as Node)) {
			props.onClose();
		}
	}

	createEffect(() => {
		if (props.position) {
			setActiveIndex(-1);
			document.addEventListener("keydown", handleKeyDown);
			document.addEventListener("mousedown", handleClickOutside);
		} else {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("mousedown", handleClickOutside);
		}
	});

	onCleanup(() => {
		document.removeEventListener("keydown", handleKeyDown);
		document.removeEventListener("mousedown", handleClickOutside);
	});

	return (
		<Show when={props.position}>
			<Portal>
				<div
					ref={rootRef}
					class={$.root}
					role="menu"
					style={{
						position: "fixed",
						left: `${clampedPosition().x}px`,
						top: `${clampedPosition().y}px`,
					}}
				>
					<For each={props.items}>
						{(item) => {
							if (item.divider) {
								return <hr class={$.divider} />;
							}

							const selectableIdx = () => selectableItems().findIndex((si) => si.id === item.id);

							return (
								<div
									class={$.item}
									role="menuitem"
									tabIndex={0}
									style={{
										background: activeIndex() === selectableIdx() ? "#3A5BA0" : undefined,
									}}
									onClick={() => props.onSelect(item.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter") props.onSelect(item.id);
									}}
									onMouseEnter={() => setActiveIndex(selectableIdx())}
								>
									<Show when={item.icon}>
										<span class={$.icon}>{item.icon}</span>
									</Show>
									<span class={$.label}>{item.label}</span>
									<Show when={item.shortcut}>
										<span class={$.shortcut}>{item.shortcut}</span>
									</Show>
								</div>
							);
						}}
					</For>
				</div>
			</Portal>
		</Show>
	);
}
