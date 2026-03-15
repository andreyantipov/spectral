import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_NAME, APP_VERSION } from "@ctrl/core.shared";
import { ensureSchema } from "@ctrl/domain.adapter.db";
import { type ElectrobunRpcHandle, ElectrobunServerProtocol } from "@ctrl/domain.adapter.rpc";
import { BrowsingRpcs } from "@ctrl/domain.service.browsing";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Layer, ManagedRuntime, Runtime } from "effect";
import { ApplicationMenu, BrowserWindow } from "electrobun/bun";
import { type AppLayer, DesktopLive } from "./layers";
import { createMainRPC } from "./rpc";
import { ViewManager } from "./view-manager";

// Ensure data directory exists
mkdirSync(join(homedir(), ".ctrl.page"), { recursive: true });

const runtime = ManagedRuntime.make(DesktopLive);

// Initialize Effect runtime (database, services, etc.)
const rt = await runtime.runtime();

// Ensure database schema exists
await Runtime.runPromise(rt)(ensureSchema);

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
		submenu: [{ label: "Toggle Full Screen", role: "toggleFullScreen", accelerator: "Cmd+Ctrl+F" }],
	},
	{
		label: "Window",
		submenu: [{ role: "minimize" }, { role: "zoom" }],
	},
]);

// Create ViewManager (BrowserView management only, no domain logic)
// TODO: Wire ViewManager to BrowsingService.sessionChanges stream
// to sync BrowserViews with sessions (create/destroy/navigate).
// This requires the RPC server streaming to be fully operational.
const viewManager = new ViewManager();

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

// Wire up ViewManager with window context
viewManager.setWindow(win);

// Start the Effect RPC server over the Electrobun IPC tunnel.
// The server listens on the webview's RPC handle and routes requests
// to BrowsingHandlersLive (already in the runtime context).
// The Electrobun RPC handle is structurally compatible with ElectrobunRpcHandle
// but the Electrobun types are opaque, so we cast.
const rpcHandle = win.webview.rpc as unknown as ElectrobunRpcHandle;

const SerializationLive = RpcSerialization.layerJson;

const ServerProtocolLive = Layer.scoped(
	RpcServer.Protocol,
	ElectrobunServerProtocol(rpcHandle),
).pipe(Layer.provide(SerializationLive));

const HandlersFromRuntime = Layer.succeedContext(rt.context) as Layer.Layer<AppLayer, never, never>;

const ServerLive = RpcServer.layer(BrowsingRpcs).pipe(
	Layer.provide(ServerProtocolLive),
	Layer.provide(HandlersFromRuntime),
) as Layer.Layer<never, never, never>;

// Fork the RPC server — runs for the lifetime of the app
// TODO: Dispose runtime and rpcServerRuntime on window close to release resources in dev mode.
const rpcServerRuntime = ManagedRuntime.make(ServerLive);
await rpcServerRuntime.runtime();

console.info(`${APP_NAME} v${APP_VERSION} started`);
