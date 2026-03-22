import { spanName } from "@ctrl/core.base.tracing";
import type { Session } from "@ctrl/core.shared";
import { assertContainsSpan, TestSpanExporter } from "@ctrl/domain.adapter.otel";
import { SESSION_FEATURE } from "@ctrl/domain.feature.session";
import { BROWSING_SERVICE, BrowsingRpcs, type BrowsingState } from "@ctrl/domain.service.browsing";
import { Headers } from "@effect/platform";
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

				// Subscribe to browsing changes BEFORE mutation
				const browsingChanges = yield* BrowsingRpcs.accessHandler("browsingChanges");
				const stream = (
					browsingChanges as (
						payload: undefined,
						headers: typeof Headers.empty,
					) => Stream.Stream<BrowsingState, never>
				)(undefined, Headers.empty);

				// Drop the initial empty state emission (from getAll() prepend in zipLatest),
				// then take the first post-mutation emission
				const fiber = yield* stream.pipe(
					Stream.drop(1),
					Stream.take(1),
					Stream.runCollect,
					Effect.fork,
				);

				yield* Effect.sleep(Duration.millis(10));

				const createSession = yield* BrowsingRpcs.accessHandler("createSession");
				yield* (
					createSession as (
						payload: { mode: "visual" },
						headers: typeof Headers.empty,
					) => Effect.Effect<Session, unknown>
				)({ mode: "visual" }, Headers.empty);

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

				// Verify the createSession → create chain is unbroken
				// (Other spans from stream getAll() calls may be orphaned — that's expected)
				const browsingSpanId = browsingSpan?.spanContext().spanId;
				const rootParentId = browsingSpan?.parentSpanContext?.spanId;
				const isRoot = !rootParentId || rootParentId === "0000000000000000";
				expect(isRoot).toBe(true);
				expect(sessionSpan?.parentSpanContext?.spanId).toBe(browsingSpanId);

				// Assert zero error spans
				for (const span of spans) {
					expect(span.status.code).not.toBe(2); // SpanStatusCode.ERROR = 2
				}
			}),
		);
	});
});
