import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Effect, Layer } from "effect";

/**
 * Unified OTEL layer. Configured by runtime parameter so wiring packages
 * select the correct SDK without pulling Node.js builtins (async_hooks) into
 * the browser bundle.
 *
 * Dynamic imports ensure the bundler only pulls in the SDK for the target
 * runtime — NodeSdk is excluded from browser bundles, WebSdk from bun bundles.
 */
export const OtelLive = (serviceName: string, runtime: "node" | "web"): Layer.Layer<never> => {
	const makeProcessor = () => new SimpleSpanProcessor(new OTLPTraceExporter());

	if (runtime === "node") {
		return Layer.unwrapEffect(
			Effect.promise(() =>
				import("@effect/opentelemetry").then(({ NodeSdk }) =>
					NodeSdk.layer(() => ({
						resource: { serviceName },
						spanProcessor: makeProcessor(),
					})),
				),
			),
		);
	}

	return Layer.unwrapEffect(
		Effect.promise(() =>
			import("@effect/opentelemetry/WebSdk").then((WebSdk) =>
				WebSdk.layer(() => ({
					resource: { serviceName },
					spanProcessor: makeProcessor(),
				})),
			),
		),
	);
};
