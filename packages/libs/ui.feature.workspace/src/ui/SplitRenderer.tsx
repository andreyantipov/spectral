import type { PanelRef, SplitNode } from "@ctrl/base.schema";
import type { Component, JSX } from "solid-js";
import { createSignal, For } from "solid-js";
import { LayoutRenderer } from "./LayoutRenderer";
import { ResizeHandle } from "./ResizeHandle";
import type { WorkspaceCommand } from "./types";

export type SplitRendererProps = {
	node: SplitNode;
	focusedGroupId: string | null;
	renderViewport: (panel: PanelRef) => JSX.Element;
	onCommand: (cmd: WorkspaceCommand) => void;
	onGroupFocus: (groupId: string) => void;
};

export const SplitRenderer: Component<SplitRendererProps> = (props) => {
	// Local sizes signal for immediate resize feedback
	const [localSizes, setLocalSizes] = createSignal<number[] | null>(null);

	const effectiveSizes = () => localSizes() ?? [...props.node.sizes];

	const gridTemplate = () => {
		const sizes = effectiveSizes();
		// Interleave fr units with fixed handle sizes
		const parts: string[] = [];
		for (let i = 0; i < sizes.length; i++) {
			if (i > 0) {
				parts.push("6px"); // resize handle width
			}
			parts.push(`${sizes[i]}fr`);
		}
		return parts.join(" ");
	};

	const gridStyle = (): string => {
		const template = gridTemplate();
		if (props.node.direction === "horizontal") {
			return `display: grid; grid-template-columns: ${template}; width: 100%; height: 100%; overflow: hidden; gap: 0;`;
		}
		return `display: grid; grid-template-rows: ${template}; width: 100%; height: 100%; overflow: hidden; gap: 0;`;
	};

	const handleResize = (handleIndex: number, delta: number) => {
		const sizes = effectiveSizes();
		const totalSize = sizes.reduce((a, b) => a + b, 0);
		// Convert delta pixels to fraction units (approximate: assume container is ~1000px)
		const containerEl = document.querySelector(
			`[data-split-id="${props.node.id}"]`,
		) as HTMLElement | null;
		const containerSize = containerEl
			? props.node.direction === "horizontal"
				? containerEl.offsetWidth
				: containerEl.offsetHeight
			: 1000;
		const deltaFr = (delta / containerSize) * totalSize;

		const newSizes = [...sizes];
		const minSize = totalSize * 0.05; // 5% minimum
		newSizes[handleIndex] = Math.max(minSize, newSizes[handleIndex] + deltaFr);
		newSizes[handleIndex + 1] = Math.max(minSize, newSizes[handleIndex + 1] - deltaFr);
		setLocalSizes(newSizes);
	};

	const handleResizeEnd = () => {
		const sizes = localSizes();
		if (sizes) {
			props.onCommand({ type: "resize", splitId: props.node.id, sizes });
			setLocalSizes(null);
		}
	};

	// Build interleaved children: [child, handle, child, handle, child]
	const items = () => {
		const result: { type: "child" | "handle"; index: number }[] = [];
		for (let i = 0; i < props.node.children.length; i++) {
			if (i > 0) {
				result.push({ type: "handle", index: i - 1 });
			}
			result.push({ type: "child", index: i });
		}
		return result;
	};

	return (
		<div style={gridStyle()} data-split-id={props.node.id}>
			<For each={items()}>
				{(item) => {
					if (item.type === "handle") {
						return (
							<ResizeHandle
								direction={props.node.direction}
								index={item.index}
								onResize={handleResize}
								onResizeEnd={handleResizeEnd}
							/>
						);
					}
					const child = () => props.node.children[item.index];
					return (
						<div style="overflow: hidden; min-width: 0; min-height: 0;">
							<LayoutRenderer
								layout={child()}
								focusedGroupId={props.focusedGroupId}
								renderViewport={props.renderViewport}
								onCommand={props.onCommand}
								onGroupFocus={props.onGroupFocus}
							/>
						</div>
					);
				}}
			</For>
		</div>
	);
};
