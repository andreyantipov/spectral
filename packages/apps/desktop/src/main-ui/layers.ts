import { OTEL_SERVICE_NAMES, OtelWebLive } from "@ctrl/domain.adapter.otel/web";
import type { ElectrobunRpcHandle } from "@ctrl/domain.adapter.rpc";
import { createWebviewLive } from "@ctrl/domain.runtime.webview";
import { Layer } from "effect";

export const createDesktopWebviewLive = (electrobunRpc: ElectrobunRpcHandle) =>
	createWebviewLive(electrobunRpc).pipe(Layer.provide(OtelWebLive(OTEL_SERVICE_NAMES.webview)));
