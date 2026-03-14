import { NodeSdk } from "@effect/opentelemetry"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

export const OtelLive = (serviceName: string) =>
  NodeSdk.layer(() => ({
    resource: { serviceName },
    spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
  }))
