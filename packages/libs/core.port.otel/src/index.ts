import { Context, type Layer } from "effect";

/**
 * Observability port — tracing interface.
 *
 * Implementations:
 * - domain.adapter.otel (OpenTelemetry + OTLP exporter)
 */

export class Observability extends Context.Tag("Observability")<
	Observability,
	{
		readonly createTracer: (serviceName: string) => Layer.Layer<never, never, never>;
	}
>() {}
