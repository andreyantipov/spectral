import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

export const OtelLive = (serviceName: string) =>
	NodeSdk.layer(() => ({
		resource: { serviceName },
		spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter()),
	}));
