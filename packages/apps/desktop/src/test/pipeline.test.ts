import { spanName, type Session } from "@ctrl/core.shared";
import { assertContainsSpan, TestSpanExporter } from "@ctrl/domain.adapter.otel";
import { SESSION_FEATURE } from "@ctrl/domain.feature.session";
import { BROWSING_SERVICE, BrowsingRpcs } from "@ctrl/domain.service.browsing";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { Chunk, Duration, Effect, Fiber, ManagedRuntime, Stream } from "effect";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PipelineTestLayer, resetMockSessions } from "./test-layers";

const runtime = ManagedRuntime.make(PipelineTestLayer);

afterAll(() => runtime.dispose());

describe("Full pipeline", () => {
	beforeEach(() => {
		resetMockSessions();
	});

	it("session creation flows end-to-end", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const exporter = yield* TestSpanExporter;
				exporter.reset();

				// Subscribe to session changes BEFORE mutation
				const sessionChanges = yield* BrowsingRpcs.accessHandler("sessionChanges");
				const stream = sessionChanges(undefined as any, {
					headers: {} as any,
				}) as Stream.Stream<{ readonly sessions: readonly Session[] }, any>;

				const fiber = yield* stream.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));

				const createSession = yield* BrowsingRpcs.accessHandler("createSession");
				yield* createSession({ mode: "visual" }, { headers: {} as any }) as Effect.Effect<
					Session,
					any
				>;

				// Join fiber — verify stream delivered BrowsingState with 1 session
				const collected = yield* Fiber.join(fiber);
				const results = Chunk.toArray(collected);

				expect(results).toHaveLength(1);
				expect(results[0].sessions).toHaveLength(1);

				// Allow spans to flush
				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				const expectedBrowsingSpan = spanName(BROWSING_SERVICE, "createSession");
				const expectedSessionSpan = spanName(SESSION_FEATURE, "create");

				// Assert spans contain expected names
				assertContainsSpan(spans, expectedBrowsingSpan);
				assertContainsSpan(spans, expectedSessionSpan);

				// Verify parent-child chain: SessionFeature.create is a child of BrowsingService.createSession
				const browsingSpan = spans.find((s: ReadableSpan) => s.name === expectedBrowsingSpan);
				const sessionSpan = spans.find((s: ReadableSpan) => s.name === expectedSessionSpan);

				expect(browsingSpan).toBeDefined();
				expect(sessionSpan).toBeDefined();

				// SessionFeature.create should be a child of BrowsingService.createSession
				expect(sessionSpan?.parentSpanContext?.spanId).toBe(browsingSpan?.spanContext().spanId);

				// Assert parent-child chain is unbroken
				for (const span of spans) {
					if (span === browsingSpan) {
						const parentId = span.parentSpanContext?.spanId;
						const isRoot = !parentId || parentId === "0000000000000000";
						expect(isRoot).toBe(true);
					} else {
						expect(span.parentSpanContext?.spanId).toBeDefined();
						expect(span.parentSpanContext?.spanId).not.toBe("0000000000000000");
					}
				}

				// Assert zero error spans
				for (const span of spans) {
					expect(span.status.code).not.toBe(2); // SpanStatusCode.ERROR = 2
				}
			}),
		);
	});
});
