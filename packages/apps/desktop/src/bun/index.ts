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

console.info(`[bun] ${APP_NAME} starting...`);

// Ensure data directory exists
mkdirSync(join(homedir(), ".ctrl.page"), { recursive: true });

const runtime = ManagedRuntime.make(DesktopLive);

// Initialize Effect runtime (database, services, etc.)
const rt = await runtime.runtime();

// Ensure database schema exists
await Runtime.runPromise(rt)(ensureSchema);

// Register menu event handler BEFORE setting the menu
// Log everything to debug event delivery
ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
	console.info("[bun] menu-clicked raw event:", JSON.stringify(event, null, 2));
	const asAny = event as Record<string, unknown>;
	const action =
		(asAny?.data as Record<string, unknown>)?.action ??
		asAny?.action ??
		(typeof asAny?.detail === "string" ? asAny.detail : undefined);
	console.info("[bun] extracted action:", action);

	if (action === "toggle-command-center") {
		console.info("[bun] executing toggle in webview");
		win.webview.executeJavascript(
			'window.dispatchEvent(new CustomEvent("ctrl:toggle-command-center"))',
		);
	}
});

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

const ServerLive = RpcServer.layer(BrowsingRpcs).pipe(
	Layer.provide(ServerProtocolLive),
	Layer.provide(HandlersFromRuntime),
) as Layer.Layer<never, never, never>;

// Fork the RPC server — runs for the lifetime of the app
const rpcServerRuntime = ManagedRuntime.make(ServerLive);
await rpcServerRuntime.runtime();

console.info(`[bun] ${APP_NAME} v${APP_VERSION} started`);
