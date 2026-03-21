import type { PanelProps } from "@ctrl/ui.adapter.dockview";
import { DockviewProvider } from "@ctrl/ui.adapter.dockview";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { useWorkspace } from "../api/use-workspace";
import { workspace } from "./workspace.style";

function SessionPanel(props: PanelProps): JSX.Element {
	return (
		<div style={{ width: "100%", height: "100%", background: "#1e1e1e" }}>
			{String(props.params.sessionId ?? "session")}
		</div>
	);
}

function EmptyPanel(_props: PanelProps): JSX.Element {
	return <div style={{ width: "100%", height: "100%", background: "#1e1e1e" }} />;
}

export type WorkspaceRootProps = {
	children?: JSX.Element;
};

export function WorkspaceRoot(props: WorkspaceRootProps) {
	const $ = workspace();
	const { initialLayout, onReady } = useWorkspace();

	const components = {
		session: SessionPanel,
		empty: EmptyPanel,
	};

	return (
		<div class={$.root}>
			<Show when={!initialLayout.loading} fallback={props.children}>
				<DockviewProvider components={components} onReady={onReady} />
			</Show>
		</div>
	);
}
