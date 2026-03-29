import type { JSX } from "solid-js";

export type EmptyPaneProps = {
	onCreateTab: () => void;
};

export function EmptyPane(props: EmptyPaneProps): JSX.Element {
	return (
		<button
			type="button"
			style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: #1e1e1e; cursor: pointer; border: none; padding: 0;"
			onClick={() => props.onCreateTab()}
		>
			<span style="color: rgba(255,255,255,0.2); font-size: 32px; font-family: Inter, sans-serif;">
				+
			</span>
		</button>
	);
}
