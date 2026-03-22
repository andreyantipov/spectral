import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_NAME, APP_VERSION } from "@ctrl/core.base.types";
import { EventBusRpcs } from "@ctrl/core.port.event-bus";
import { ensureSchema } from "@ctrl/domain.adapter.db";
import { createIpcBridge, type ElectrobunHandle } from "@ctrl/domain.adapter.electrobun";
import { OTEL_SERVICE_NAMES, OtelLive } from "@ctrl/domain.adapter.otel";
import { type ElectrobunRpcHandle, ElectrobunServerProtocol } from "@ctrl/domain.adapter.rpc";
import { BrowsingRpcs } from "@ctrl/domain.service.browsing";
import { WorkspaceRpcs } from "@ctrl/domain.service.workspace";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Layer, ManagedRuntime, Runtime } from "effect";
import { ApplicationMenu, BrowserWindow } from "electrobun/bun";
import { startCommandRouter } from "./command-router";
import { type AppLayer, DesktopLive } from "./layers";
import { createMainRPC } from "./rpc";

console.info(`[bun] ${APP_NAME} starting...`);

// Ensure data directory exists
mkdirSync(join(homedir(), ".ctrl.page"), { recursive: true });

const runtime = ManagedRuntime.make(DesktopLive);

// Initialize Effect runtime (database, services, etc.)
const rt = await runtime.runtime();

// Ensure database schema exists
await Runtime.runPromise(rt)(ensureSchema);

// Start the EventBus command router (keyboard shortcuts → feature services)
// Cast: runtime provides all services including EventBus + SessionFeature + OmniboxFeature
startCommandRouter(rt as unknown as Parameters<typeof startCommandRouter>[0]);

ApplicationMenu.setApplicationMenu([
	{
		submenu: [
			{ label: `About ${APP_NAME}`, role: "about" },
			{ type: "separator" },
			{ label: "Quit", role: "quit", accelerator: "Cmd+Q" },
		],
	},
	{
		label: "File",
		submenu: [{ label: "Close Window", role: "close", accelerator: "Cmd+W" }],
	},
	{
		label: "Edit",
		submenu: [
			{ role: "undo" },
			{ role: "redo" },
			{ type: "separator" },
			{ role: "cut" },
			{ role: "copy" },
			{ role: "paste" },
			{ role: "selectAll" },
		],
	},
	{
		label: "View",
		submenu: [
			{ label: "Command Center", action: "toggle-command-center", accelerator: "Cmd+K" },
			{ type: "separator" },
			{ label: "Toggle Full Screen", role: "toggleFullScreen", accelerator: "Cmd+Ctrl+F" },
		],
	},
	{
		label: "Window",
		submenu: [{ role: "minimize" }, { role: "zoom" }],
	},
]);

// Create Electrobun RPC (legacy request/response + effect-rpc message channel)
const mainRPC = createMainRPC(rt);

// Create window
const win = new BrowserWindow({
	title: APP_NAME,
	url: "views://main-ui/index.html",
	frame: { x: 0, y: 0, width: 1200, height: 800 },
	titleBarStyle: "hiddenInset",
	transparent: false,
	rpc: mainRPC,
});

// Start the Effect RPC server over the Electrobun IPC tunnel.
const rpcHandle = win.webview.rpc as unknown as ElectrobunRpcHandle;

const SerializationLive = RpcSerialization.layerJson;

const ServerProtocolLive = Layer.scoped(
	RpcServer.Protocol,
	ElectrobunServerProtocol(rpcHandle),
).pipe(Layer.provide(SerializationLive));

const HandlersFromRuntime = Layer.succeedContext(rt.context) as Layer.Layer<AppLayer, never, never>;

const AllRpcs = BrowsingRpcs.merge(WorkspaceRpcs).merge(EventBusRpcs);
const ServerLive = RpcServer.layer(AllRpcs).pipe(
	Layer.provide(ServerProtocolLive),
	Layer.provide(HandlersFromRuntime),
	Layer.provide(OtelLive(OTEL_SERVICE_NAMES.main)),
) as Layer.Layer<never, never, never>;

// Fork the RPC server — runs for the lifetime of the app
const rpcServerRuntime = ManagedRuntime.make(ServerLive);
await rpcServerRuntime.runtime();

// Create IPC bridge for app commands (uses same handle as effect-rpc)
const ipcBridge = createIpcBridge(rpcHandle as unknown as ElectrobunHandle);

// Menu accelerator → IPC bridge (no executeJavascript!)
ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
	const data = (event as { data?: { action?: string } })?.data;
	if (data?.action === "toggle-command-center") {
		ipcBridge.send({ type: "toggle-command-center" });
	}
});

console.info(`[bun] ${APP_NAME} v${APP_VERSION} started`);
