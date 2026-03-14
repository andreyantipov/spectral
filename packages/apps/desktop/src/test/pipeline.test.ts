import { spanName } from "@ctrl/core.shared";
import { assertContainsSpan, TestSpanExporter } from "@ctrl/domain.adapter.otel";
import { TAB_FEATURE } from "@ctrl/domain.feature.tab";
import { BROWSING_SERVICE, BrowsingService } from "@ctrl/domain.service.browsing";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { Chunk, Duration, Effect, Fiber, ManagedRuntime, Stream } from "effect";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PipelineTestLayer, resetMockTabs } from "./test-layers";

const runtime = ManagedRuntime.make(PipelineTestLayer);

afterAll(() => runtime.dispose());

describe("Full pipeline", () => {
	beforeEach(() => {
		resetMockTabs();
	});

	it("tab creation flows end-to-end", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const browsing = yield* BrowsingService;
				const exporter = yield* TestSpanExporter;
				exporter.reset();

				// Subscribe to changes BEFORE mutation
				const fiber = yield* browsing.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));
				yield* browsing.createTab("https://example.com");

				// Join fiber — verify stream delivered BrowsingState with 1 tab
				const collected = yield* Fiber.join(fiber);
				const results = Chunk.toArray(collected);

				expect(results).toHaveLength(1);
				expect(results[0].tabs).toHaveLength(1);
				expect(results[0].tabs[0].url).toBe("https://example.com");

				// Allow spans to flush
				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				const expectedBrowsingSpan = spanName(BROWSING_SERVICE, "createTab");
				const expectedTabSpan = spanName(TAB_FEATURE, "create");

				// Assert spans contain expected names
				assertContainsSpan(spans, expectedBrowsingSpan);
				assertContainsSpan(spans, expectedTabSpan);

				// Verify parent-child chain
				const browsingSpan = spans.find((s: ReadableSpan) => s.name === expectedBrowsingSpan);
				const tabSpan = spans.find((s: ReadableSpan) => s.name === expectedTabSpan);

				expect(browsingSpan).toBeDefined();
				expect(tabSpan).toBeDefined();

				// TabFeature.create should be a child of BrowsingService.createTab
				expect(tabSpan?.parentSpanContext?.spanId).toBe(browsingSpan?.spanContext().spanId);

				// Assert parent-child chain is unbroken
				// The root span (browsingSpan) should have no valid parent trace
				// All child spans should have a valid parentSpanId
				for (const span of spans) {
					if (span === browsingSpan) {
						// Root span: parent span ID should be all zeros or undefined
						const parentId = span.parentSpanContext?.spanId;
						const isRoot = !parentId || parentId === "0000000000000000";
						expect(isRoot).toBe(true);
					} else {
						// Child spans should have a valid parent
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
