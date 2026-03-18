import { createEffect, createSignal, For, type JSX, Show } from "solid-js";
import { sidebar } from "./sidebar.style";

export type SidebarTab = {
	id: string;
	icon: JSX.Element;
	label: string;
	badge?: number;
};

export type SidebarItem = {
	id: string;
	icon?: JSX.Element;
	label: string;
	secondaryLabel?: string;
	indent?: number;
};

export type SidebarProps = {
	tabs: SidebarTab[];
	activeTabId?: string | null;
	items?: SidebarItem[];
	activeItemId?: string | null;
	position?: "left" | "right";
	float?: boolean;
	defaultWidth?: number;
	minWidth?: number;
	maxWidth?: number;
	collapsed?: boolean;
	onTabClick?: (id: string) => void;
	onItemClick?: (id: string) => void;
	onItemClose?: (id: string) => void;
	onNewSession?: () => void;
	onHeaderClick?: () => void;
	onWidthChange?: (width: number) => void;
	onCollapseChange?: (collapsed: boolean) => void;
	panelActions?: JSX.Element;
	headerContent?: JSX.Element;
	children?: JSX.Element;
};

export function Sidebar(props: SidebarProps) {
	const minW = () => props.minWidth ?? 180;
	const maxW = () => props.maxWidth ?? 400;
	const [width, setWidth] = createSignal(props.defaultWidth ?? 240);
	const [dragging, setDragging] = createSignal(false);
	const collapsed = () => props.collapsed ?? false;
	const float = () => props.float ?? false;
	const position = () => props.position ?? "left";

	const $ = () => sidebar({ position: position(), float: float() });
	const $activeTab = () => sidebar({ position: position(), float: float(), activeTab: true });
	const $activeItem = () => sidebar({ position: position(), float: float(), activeItem: true });

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		setDragging(true);
		const startX = e.clientX;
		const startW = width();

		function onPointerMove(e: PointerEvent) {
			const delta = position() === "left" ? e.clientX - startX : startX - e.clientX;
			const next = Math.max(minW(), Math.min(maxW(), startW + delta));
			setWidth(next);
			props.onWidthChange?.(next);
		}

		function onPointerUp() {
			setDragging(false);
			document.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("pointerup", onPointerUp);
		}

		document.addEventListener("pointermove", onPointerMove);
		document.addEventListener("pointerup", onPointerUp);
	}

	createEffect(() => {
		if (props.defaultWidth !== undefined) {
			setWidth(props.defaultWidth);
		}
	});

	return (
		<div
			class={$().root}
			style={{
				width: collapsed() ? undefined : `${width()}px`,
			}}
		>
			{/* Icon rail — only shown when there are multiple tabs */}
			<Show when={props.tabs.length > 0}>
				<div class={$().rail}>
					<div class={$().railTabs}>
						<For each={props.tabs}>
							{(tab) => {
								const s = () => (tab.id === props.activeTabId ? $activeTab() : $());
								return (
									<button
										type="button"
										class={s().railTab}
										onClick={() => {
											if (tab.id === props.activeTabId && !collapsed()) {
												props.onCollapseChange?.(true);
											} else {
												props.onCollapseChange?.(false);
												props.onTabClick?.(tab.id);
											}
										}}
										title={tab.label}
									>
										<span class={s().railTabIcon}>{tab.icon}</span>
										<Show when={tab.badge}>
											<span class={s().railTabBadge}>{tab.badge}</span>
										</Show>
									</button>
								);
							}}
						</For>
					</div>
				</div>
			</Show>

			{/* Expandable panel */}
			<Show when={!collapsed()}>
				<div class={$().panel}>
					<div class={$().panelHeader} style={{ gap: "6px" }}>
						<Show
							when={props.headerContent}
							fallback={
								<span class={$().panelTitle}>
									{props.tabs.find((t) => t.id === props.activeTabId)?.label ?? ""}
								</span>
							}
						>
							<button
								type="button"
								onClick={() => props.onHeaderClick?.()}
								style={{
									flex: "1",
									cursor: "pointer",
									"min-width": "0",
									background: "none",
									border: "none",
									padding: "0",
									color: "inherit",
									font: "inherit",
									"text-align": "left",
								}}
							>
								{props.headerContent}
							</button>
						</Show>
						{props.panelActions}
						<Show when={props.onNewSession}>
							<button
								type="button"
								onClick={() => props.onNewSession?.()}
								title="New session"
								style={{
									background: "rgba(255,255,255,0.06)",
									border: "1px solid rgba(255,255,255,0.1)",
									"border-radius": "6px",
									color: "rgba(255,255,255,0.5)",
									"font-size": "12px",
									padding: "4px 8px",
									cursor: "pointer",
									"line-height": "1",
									"flex-shrink": "0",
								}}
							>
								+
							</button>
						</Show>
					</div>

					<div class={$().panelContent}>
						<Show when={props.items}>
							<For each={props.items}>
								{(item) => {
									const s = () => (item.id === props.activeItemId ? $activeItem() : $());
									return (
										<button
											type="button"
											class={s().panelItem}
											style={{
												"padding-left": `${8 + (item.indent ?? 0) * 12}px`,
											}}
											onClick={() => props.onItemClick?.(item.id)}
										>
											<Show when={item.icon}>
												<span class={s().panelItemIcon}>{item.icon}</span>
											</Show>
											<span class={s().panelItemLabel}>{item.label}</span>
											<Show when={item.secondaryLabel}>
												<span class={s().panelItemSecondary}>{item.secondaryLabel}</span>
											</Show>
											<Show when={props.onItemClose}>
												<button
													type="button"
													class={`${s().panelItemClose} panelItemClose`}
													onClick={(e) => {
														e.stopPropagation();
														props.onItemClose?.(item.id);
													}}
												>
													&times;
												</button>
											</Show>
										</button>
									);
								}}
							</For>
						</Show>
						{props.children}
					</div>
				</div>

				{/* Resize handle */}
				<div
					class={$().resizeHandle}
					data-dragging={dragging() || undefined}
					onPointerDown={onPointerDown}
				/>
			</Show>
		</div>
	);
}
