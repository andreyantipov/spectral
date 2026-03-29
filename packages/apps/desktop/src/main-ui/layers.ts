import { createUiProcess, type ElectrobunIpcHandle } from "@ctrl/wire.desktop.ui";

export const createDesktopWebviewLive = (handle: ElectrobunIpcHandle) => createUiProcess(handle);
