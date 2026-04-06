import { homedir } from "node:os";
import { join } from "node:path";
import { makeDbClient } from "@ctrl/arch.impl.db";
import { createMainProcess, type ElectrobunIpcHandle } from "@ctrl/wire.desktop.main";

const dbPath = join(homedir(), ".spectral", "data.db");

/** Minimal DB layer for running ensureSchema before services start */
export const DbOnlyLive = makeDbClient(`file:${dbPath}`);

export const createDesktopMainLive = (handle: ElectrobunIpcHandle) =>
	createMainProcess(handle, dbPath);
