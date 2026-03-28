import { OTEL_SERVICE_NAMES, OtelWebLive } from "@ctrl/domain.adapter.otel/web";
import { createWebviewLive } from "@ctrl/domain.runtime.webview";
import type { ElectrobunRpcHandle } from "@ctrl/domain.service.native";
import { Layer } from "effect";

export const createDesktopWebviewLive = (electrobunRpc: ElectrobunRpcHandle) =>
	createWebviewLive(electrobunRpc).pipe(Layer.provide(OtelWebLive(OTEL_SERVICE_NAMES.webview)));
