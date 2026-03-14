import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_NAME, APP_VERSION } from "@ctrl/core.shared";
import { LibsqlClient } from "@effect/sql-libsql";
import { Effect, ManagedRuntime, Runtime } from "effect";
import { ApplicationMenu, BrowserWindow } from "electrobun/bun";
import { DesktopLive } from "./layers";
import { createMainRPC } from "./rpc";
import { TabManager } from "./tab-manager";

// Ensure data directory exists
mkdirSync(join(homedir(), ".ctrl.page"), { recursive: true });

const runtime = ManagedRuntime.make(DesktopLive);

// Initialize Effect runtime (database, services, etc.)
const rt = await runtime.runtime();

// Ensure tabs table exists (using LibsqlClient from new hex architecture)
await Runtime.runPromise(rt)(
	Effect.gen(function* () {
		const sql = yield* LibsqlClient.LibsqlClient;
		yield* sql`
			CREATE TABLE IF NOT EXISTS tabs (
				id TEXT PRIMARY KEY,
				url TEXT NOT NULL,
				title TEXT,
				position INTEGER NOT NULL DEFAULT 0,
				isActive INTEGER NOT NULL DEFAULT 0,
				createdAt TEXT NOT NULL,
				updatedAt TEXT NOT NULL
			)
		`;
	}),
);

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

// Create TabManager with Effect runtime
const tabManager = new TabManager(rt);

// Create RPC with tabManager
const mainRPC = createMainRPC(rt, tabManager);

// Create window
const win = new BrowserWindow({
	title: APP_NAME,
	url: "views://main-ui/index.html",
	frame: { x: 0, y: 0, width: 1200, height: 800 },
	titleBarStyle: "hiddenInset",
	transparent: false,
	rpc: mainRPC,
});

// Wire up tabManager with window context
tabManager.setWindow(win);
tabManager.setRPC(win.webview.rpc);

// Initialize tabs (loads from DB, creates content view)
await tabManager.init();

console.info(`${APP_NAME} v${APP_VERSION} started`);
