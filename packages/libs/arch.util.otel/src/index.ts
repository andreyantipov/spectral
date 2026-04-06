export { OtelLive } from "./model/otel.config";
export { initGlobalWebTracer } from "./model/otel-web-global.config";

export const OTEL_SERVICE_NAMES = {
	main: "spectral.main",
	webview: "spectral.webview",
} as const;
