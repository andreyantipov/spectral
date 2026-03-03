import Electrobun, { BrowserWindow, ApplicationMenu } from "electrobun/bun";
import { Effect, ManagedRuntime, Runtime } from "effect";
import { APP_NAME, APP_VERSION } from "@ctrl/core.shared";
import { ensureTabsTable } from "@ctrl/core.db";
import { DesktopLive } from "./layers";
import { createMainRPC } from "./rpc";
import { TabManager } from "./tab-manager";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Ensure data directory exists
mkdirSync(join(homedir(), ".ctrl.page"), { recursive: true });

const runtime = ManagedRuntime.make(DesktopLive);

// Initialize Effect runtime (database, services, etc.)
const rt = await runtime.runtime();

// Ensure tabs table exists
await Runtime.runPromise(rt)(ensureTabsTable);

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
    submenu: [
      { label: "Close Window", role: "close", accelerator: "Cmd+W" },
    ],
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
      { label: "Toggle Full Screen", role: "toggleFullScreen", accelerator: "Cmd+Ctrl+F" },
    ],
  },
  {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
    ],
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
tabManager.setWindowId(win.id);
tabManager.setRPC(win.webview.rpc);

// Initialize tabs (loads from DB, creates content view)
await tabManager.init();

console.log(`${APP_NAME} v${APP_VERSION} started`);
