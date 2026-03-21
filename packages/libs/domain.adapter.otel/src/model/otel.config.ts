import { NodeSdk } from "@effect/opentelemetry"
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

export const OtelLive = (serviceName: string) =>
  NodeSdk.layer(() => ({
    resource: { serviceName },
    spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter()),
  }))
