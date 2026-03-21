import { currentUrl, type Session } from "@ctrl/core.shared";
import { BlankPage } from "@ctrl/core.ui";
import { SessionWebview } from "@ctrl/ui.adapter.electrobun";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import { createMemo, For, Show } from "solid-js";

export function MainScene() {
	return (
		<SidebarFeature>
			{(bindings: WebviewBindings) => {
				const sessionIds = createMemo(
					() => bindings.sessions().map((s) => s.id),
					undefined,
					{
						equals: (a, b) =>
							a.length === b.length && a.every((id, i) => id === b[i]),
					},
				);

				const getSession = (id: string): Session | undefined =>
					bindings.sessions().find((s) => s.id === id);

				const isActiveBlank = () => {
					const s = bindings.sessions().find((s) => s.id === bindings.activeSessionId());
					if (!s) return true;
					const url = currentUrl(s);
					return !url || url === "about:blank";
				};

				return (
					<div style="display: flex; flex: 1; width: 100%; height: 100%; position: relative;">
						<For each={sessionIds()}>
							{(id) => {
								const url = () => {
									const s = getSession(id);
									return s ? (currentUrl(s) ?? "about:blank") : "about:blank";
								};

								return (
									<SessionWebview
										sessionId={id}
										url={url()}
										isActive={bindings.activeSessionId() === id}
										onNavigate={(navUrl) => bindings.onNavigate(id, navUrl)}
										onTitleChange={(title) => bindings.onTitleChange(id, title)}
									/>
								);
							}}
						</For>
						<Show when={isActiveBlank()}>
							<div style="position: absolute; inset: 0; z-index: 1;">
								<BlankPage />
							</div>
						</Show>
					</div>
				);
			}}
		</SidebarFeature>
	);
}
