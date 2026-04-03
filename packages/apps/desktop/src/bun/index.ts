import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_NAME } from "@ctrl/base.type";
import rootPkg from "../../../../../package.json";

const APP_VERSION = rootPkg.version;

import { EventBus } from "@ctrl/core.contract.event-bus";
import { type ElectrobunIpcHandle, ensureSchema } from "@ctrl/wire.desktop.main";
import { Effect, ManagedRuntime } from "effect";
import { ApplicationMenu, BrowserWindow } from "electrobun/bun";
import { createDesktopMainLive, DbOnlyLive } from "./layers";
import { createMainRPC } from "./rpc";

console.info(`[bun] ${APP_NAME} starting...`);

// Ensure data directory exists
mkdirSync(join(homedir(), ".spectral"), { recursive: true });

// Electrobun RPC: static handlers only, no runtime needed
const mainRPC = createMainRPC();

// Create window
const win = new BrowserWindow({
	title: APP_NAME,
	url: "views://main-ui/index.html",
	frame: { x: 0, y: 0, width: 1200, height: 800 },
	titleBarStyle: "hiddenInset",
	transparent: false,
	rpc: mainRPC,
});

// The Electrobun RPC handle doubles as the IPC channel for EventBus bridging
const rpcHandle = win.webview.rpc as unknown as ElectrobunIpcHandle;

// Ensure database schema exists BEFORE services start (they query on startup)
await Effect.runPromise(ensureSchema.pipe(Effect.provide(DbOnlyLive)));

// Initialize Effect runtime with IPC bridge wired to the webview
const runtime = ManagedRuntime.make(createDesktopMainLive(rpcHandle));

// Ensure runtime is up (database, services, IPC bridge)
const rt = await runtime.runtime();

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

// Menu accelerator → EventBus command
ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
	const data = (event as { data?: { action?: string } })?.data;
	if (data?.action === "toggle-command-center") {
		void runtime.runPromise(
			EventBus.pipe(
				Effect.flatMap((bus) =>
					bus.send({ type: "command", action: "ui.toggle-omnibox", meta: { source: "menu" } }),
				),
			),
		);
	}
});

// Keep runtime alive
void rt;

console.info(`[bun] ${APP_NAME} v${APP_VERSION} started`);
