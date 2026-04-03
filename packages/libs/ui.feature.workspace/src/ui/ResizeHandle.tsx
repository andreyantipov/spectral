import type { Component } from "solid-js";
import { workspace } from "./workspace.style";

export type ResizeHandleProps = {
	direction: "horizontal" | "vertical";
	index: number;
	onResize: (index: number, delta: number) => void;
	onResizeEnd: () => void;
};

export const ResizeHandle: Component<ResizeHandleProps> = (props) => {
	const $ = () => workspace({ direction: props.direction });

	let startPos = 0;

	const onPointerDown = (e: PointerEvent) => {
		e.preventDefault();
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
		startPos = props.direction === "horizontal" ? e.clientX : e.clientY;
	};

	const onPointerMove = (e: PointerEvent) => {
		const target = e.currentTarget as HTMLElement;
		if (!target.hasPointerCapture(e.pointerId)) return;
		const currentPos = props.direction === "horizontal" ? e.clientX : e.clientY;
		const delta = currentPos - startPos;
		startPos = currentPos;
		props.onResize(props.index, delta);
	};

	const onPointerUp = (e: PointerEvent) => {
		const target = e.currentTarget as HTMLElement;
		if (target.hasPointerCapture(e.pointerId)) {
			target.releasePointerCapture(e.pointerId);
		}
		props.onResizeEnd();
	};

	return (
		<div
			class={$().resizeHandle}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onLostPointerCapture={() => props.onResizeEnd()}
		/>
	);
};
