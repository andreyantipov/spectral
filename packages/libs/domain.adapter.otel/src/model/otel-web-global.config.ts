import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";

/**
 * Register a global OpenTelemetry tracer provider for imperative (non-Effect)
 * browser code. Call once at app startup.
 *
 * This enables `trace.getTracer()` and `withWebTracing()` to produce real
 * spans that export to the OTLP collector alongside Effect-managed spans.
 */
export const initGlobalWebTracer = (serviceName: string) => {
	const provider = new WebTracerProvider({
		resource: resourceFromAttributes({ "service.name": serviceName }),
		spanProcessors: [new SimpleSpanProcessor(new OTLPTraceExporter())],
	});
	provider.register();
	return provider;
};
