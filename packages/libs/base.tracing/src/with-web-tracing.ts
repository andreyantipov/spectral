import { SpanStatusCode, trace } from "@opentelemetry/api";
import { spanName } from "./span-name";

/**
 * Wraps all methods of a service object with OpenTelemetry spans.
 *
 * Unlike `withTracing()` (which wraps Effect-returning methods),
 * this wraps imperative sync/async functions — designed for UI features
 * and adapters that run outside the Effect runtime.
 *
 * Spans are created via `@opentelemetry/api`'s global tracer provider.
 * If no provider is registered (e.g., in tests), spans are no-ops.
 */
export const withWebTracing = <S extends Record<string, unknown>>(
	serviceName: string,
	service: S,
): S => {
	const tracer = trace.getTracer(serviceName);
	return Object.fromEntries(
		Object.entries(service).map(([method, fn]) => {
			if (typeof fn !== "function") return [method, fn];
			return [
				method,
				(...args: never[]) =>
					tracer.startActiveSpan(spanName(serviceName, method), (span) => {
						try {
							const result = (fn as (...a: never[]) => unknown)(...args);
							if (result instanceof Promise) {
								return result
									.then((v: unknown) => {
										span.end();
										return v;
									})
									.catch((e: unknown) => {
										span.setStatus({ code: SpanStatusCode.ERROR });
										span.end();
										throw e;
									});
							}
							span.end();
							return result;
						} catch (e) {
							span.setStatus({ code: SpanStatusCode.ERROR });
							span.end();
							throw e;
						}
					}),
			];
		}),
	) as S;
};
