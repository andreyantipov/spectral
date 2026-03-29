import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_NAME } from "@ctrl/core.base.types";
import rootPkg from "../../../../../package.json";

const APP_VERSION = rootPkg.version;

import type { ElectrobunRpcHandle } from "@ctrl/domain.adapter.carrier";
import { createIpcBridge, type ElectrobunHandle } from "@ctrl/domain.adapter.carrier";
import { ensureSchema } from "@ctrl/domain.adapter.db";
import { OTEL_SERVICE_NAMES, OtelLive } from "@ctrl/domain.adapter.otel";
import { AllRpcs, createCarrierServer } from "@ctrl/domain.runtime.bun";
import { RpcServer } from "@effect/rpc";
import { Layer, ManagedRuntime, Runtime } from "effect";
import { ApplicationMenu, BrowserWindow } from "electrobun/bun";
import { type AppLayer, DesktopLive } from "./layers";
import { createMainRPC } from "./rpc";

console.info(`[bun] ${APP_NAME} starting...`);

// Ensure data directory exists
mkdirSync(join(homedir(), ".spectral"), { recursive: true });

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

// Start RPC server over Electrobun IPC — carrier connects Bun ↔ Webview
const rpcHandle = win.webview.rpc as unknown as ElectrobunRpcHandle;
const CarrierServerLive = createCarrierServer(rpcHandle);
const HandlersFromRuntime = Layer.succeedContext(rt.context) as Layer.Layer<AppLayer, never, never>;

const ServerLive = RpcServer.layer(AllRpcs).pipe(
	Layer.provide(CarrierServerLive),
	Layer.provide(HandlersFromRuntime),
	Layer.provide(OtelLive(OTEL_SERVICE_NAMES.main)),
) as Layer.Layer<never, never, never>;

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
