import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Effect, Layer } from "effect";

export { initGlobalWebTracer } from "./model/otel-web-global.config";

export const OTEL_SERVICE_NAMES = {
	main: "spectral.main",
	webview: "spectral.webview",
} as const;

/**
 * Browser-only OTEL layer. Uses WebSdk — no Node.js imports.
 */
export const OtelLive = (serviceName: string): Layer.Layer<never> =>
	Layer.unwrapEffect(
		Effect.promise(() =>
			import("@effect/opentelemetry/WebSdk").then((WebSdk) =>
				WebSdk.layer(() => ({
					resource: { serviceName },
					spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter()),
				})),
			),
		),
	);
