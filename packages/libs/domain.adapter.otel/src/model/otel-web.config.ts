import * as WebSdk from "@effect/opentelemetry/WebSdk"
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

export const OtelWebLive = (serviceName: string) =>
  WebSdk.layer(() => ({
    resource: { serviceName },
    spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter()),
  }))
