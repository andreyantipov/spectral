import type { BrowsingState, PanelRef } from "@ctrl/base.schema";
import { currentUrl } from "@ctrl/base.type";
import { useApi } from "@ctrl/ui.base.api";
import { BlankPage } from "@ctrl/ui.base.components";
import { KeyboardProvider } from "@ctrl/ui.feature.keyboard-provider";
import { SidebarFeature, type WebviewBindings } from "@ctrl/ui.feature.sidebar";
import { ManagedWebview, syncAllWebviewDimensions } from "@ctrl/ui.feature.webview";
import { LayoutRoot, useWorkspace } from "@ctrl/ui.feature.workspace";
import html2canvas from "html2canvas";
import { createContext, createEffect, Show, useContext } from "solid-js";
import { SHORTCUT_PRELOAD } from "../lib/webview-constants";

const BindingsContext = createContext<WebviewBindings>();

export function MainScene() {
	return (
		<KeyboardProvider>
			<SidebarFeature>
				{(bindings: WebviewBindings) => (
					<BindingsContext.Provider value={bindings}>
						<WorkspaceContent />
					</BindingsContext.Provider>
				)}
			</SidebarFeature>
		</KeyboardProvider>
	);
}

function SessionPanel(props: { panel: PanelRef }) {
	const bindings = useContext(BindingsContext);
	const sessionId = props.panel.entityId;

	const url = () => {
		const s = bindings?.sessions().find((s) => s.id === sessionId);
		return s ? (currentUrl(s) ?? "about:blank") : "about:blank";
	};

	return (
		<ManagedWebview
			sessionId={sessionId}
			url={url()}
			isActive={bindings?.activeSessionId() === sessionId}
			overlayMasks={["[data-sidebar]", "[data-omnibox]", "[data-context-menu]"]}
			preload={SHORTCUT_PRELOAD}
			onNavigate={(navUrl) => bindings?.onNavigate(sessionId, navUrl)}
			onTitleChange={(title) => bindings?.onTitleChange(sessionId, title)}
			onNewWindow={(targetUrl) => bindings?.onNavigate(sessionId, targetUrl)}
		/>
	);
}

function WorkspaceContent() {
	const maybeBindings = useContext(BindingsContext);
	if (!maybeBindings)
		throw new Error("WorkspaceContent must be rendered inside BindingsContext.Provider");
	const bindings = maybeBindings;
	const api = useApi();
	const browsingState = api.state<BrowsingState>("browsing");

	const { layout, focusedGroupId, setFocusedGroupId, handleCommand } = useWorkspace();

	const hasSessions = () => (browsingState()?.sessions?.length ?? 0) > 0;

	// Screenshot handler: capture DOM when diag.screenshot-request arrives
	const screenshotRequest = api.on("diag.screenshot-request");
	createEffect(() => {
		const req = screenshotRequest();
		if (req === undefined) return;
		html2canvas(document.body, {
			scale: 1,
			useCORS: true,
			allowTaint: true,
			removeContainer: true,
			ignoreElements: (el: Element) => {
				const tag = el.tagName?.toLowerCase();
				return tag === "webview" || tag === "iframe" || tag === "electrobun-webview";
			},
		})
			.then((canvas) => {
				api.send("diag.screenshot-result", {
					data: canvas.toDataURL("image/png").split(",")[1],
					width: canvas.width,
					height: canvas.height,
					timestamp: Date.now(),
				});
			})
			.catch((err) => {
				// Fallback: send a canvas with error info
				const c = document.createElement("canvas");
				c.width = window.innerWidth;
				c.height = window.innerHeight;
				const ctx = c.getContext("2d");
				if (ctx) {
					ctx.fillStyle = "#1a1a2e";
					ctx.fillRect(0, 0, c.width, c.height);
					ctx.fillStyle = "#ff6b6b";
					ctx.font = "14px monospace";
					ctx.fillText(`Screenshot capture error: ${err}`, 16, 32);
				}
				api.send("diag.screenshot-result", {
					data: c.toDataURL("image/png").split(",")[1],
					width: c.width,
					height: c.height,
					timestamp: Date.now(),
				});
			});
	});

	// JS eval handler: execute arbitrary JS in the webview context
	const evalJsRequest = api.on<{ code: string }>("diag.eval-js-request");
	createEffect(() => {
		const req = evalJsRequest();
		if (req === undefined) return;
		try {
			const fn = new Function(req.code);
			const result = fn();
			if (result instanceof Promise) {
				result
					.then((v: unknown) => api.send("diag.eval-js-result", { result: String(v) }))
					.catch((e: unknown) => api.send("diag.eval-js-result", { result: "", error: String(e) }));
			} else {
				api.send("diag.eval-js-result", { result: String(result) });
			}
		} catch (e) {
			api.send("diag.eval-js-result", { result: "", error: String(e) });
		}
	});

	// Register split handler so sidebar context menu can split panes
	bindings.onSplitSession = (sessionId: string, direction: "right" | "down") => {
		api.dispatch("ws.split-panel", {
			panelId: sessionId,
			direction: direction === "right" ? "horizontal" : "vertical",
			newPanel: {
				id: crypto.randomUUID(),
				type: "session" as const,
				entityId: sessionId,
				title: "New Tab",
				icon: null,
			},
		});
	};

	const renderViewport = (panel: PanelRef) => {
		if (panel.type === "session") {
			return <SessionPanel panel={panel} />;
		}
		return <div style="width: 100%; height: 100%; background: #1e1e1e;" />;
	};

	return (
		<div style="display: flex; flex: 1; width: 100%; height: 100%; position: relative; overflow: hidden;">
			<Show
				when={layout()}
				fallback={
					<Show when={!hasSessions()}>
						<BlankPage />
					</Show>
				}
			>
				{(rootLayout) => (
					<LayoutRoot
						layout={rootLayout()}
						focusedGroupId={focusedGroupId()}
						renderViewport={renderViewport}
						onCommand={(cmd) => {
							handleCommand(cmd);
							// Sync webview dimensions after layout changes
							requestAnimationFrame(() => syncAllWebviewDimensions());
						}}
						onGroupFocus={setFocusedGroupId}
					/>
				)}
			</Show>
			<Show when={!hasSessions()}>
				<div style="position: absolute; inset: 0; z-index: 1;">
					<BlankPage />
				</div>
			</Show>
		</div>
	);
}
