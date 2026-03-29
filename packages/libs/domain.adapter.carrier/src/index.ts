// RPC protocol (Electrobun IPC tunnel for @effect/rpc)
export { ElectrobunClientProtocol } from "./api/client-protocol.js";
// IPC bridge (app-level commands: toggle-command-center, notifications)
export { createIpcBridge } from "./api/ipc-bridge";
export { ElectrobunServerProtocol } from "./api/server-protocol.js";
export type { AppCommand, ShowNotification, ToggleCommandCenter } from "./model/commands";
export type { ElectrobunRpcHandle } from "./model/electrobun-rpc.js";
export type { ElectrobunHandle } from "./model/handle";
