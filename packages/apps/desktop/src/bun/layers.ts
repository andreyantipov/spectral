import { homedir } from "node:os";
import { join } from "node:path";
import { createMainProcess, type ElectrobunIpcHandle } from "@ctrl/wire.desktop.main";

const dbPath = join(homedir(), ".spectral", "data.db");

export const createDesktopMainLive = (handle: ElectrobunIpcHandle) =>
	createMainProcess(handle, dbPath);
