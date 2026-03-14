import { spanName, type Tab, TabRepository } from "@ctrl/core.shared";
import {
	assertContainsSpan,
	TestSpanExporter,
	TestSpanExporterLive,
} from "@ctrl/domain.adapter.otel";
import { TAB_FEATURE, TabFeatureLive } from "@ctrl/domain.feature.session";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { Chunk, Duration, Effect, Fiber, Layer, ManagedRuntime, Stream } from "effect";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BROWSING_SERVICE } from "../lib/constants";
import { BrowsingService, BrowsingServiceLive } from "./browsing.service";

let nextId = 0;
let tabs: Tab[] = [];

const makeTab = (url: string): Tab => {
	const id = String(++nextId);
	return {
		id,
		url,
		title: null,
		position: 0,
		isActive: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
};

const MockTabRepository = Layer.succeed(TabRepository, {
	getAll: () => Effect.succeed(tabs),
	create: (url: string) =>
		Effect.sync(() => {
			const tab = makeTab(url);
			tabs = [...tabs, tab];
			return tab;
		}),
	remove: (id: string) =>
		Effect.sync(() => {
			tabs = tabs.filter((t) => t.id !== id);
		}),
	update: (_id: string, _data: Partial<Tab>) => Effect.void,
	getActive: () => Effect.succeed(undefined),
	setActive: (_id: string) => Effect.void,
});

const TestLayer = BrowsingServiceLive.pipe(
	Layer.provide(TabFeatureLive),
	Layer.provide(MockTabRepository),
	Layer.provideMerge(TestSpanExporterLive),
) as Layer.Layer<BrowsingService | TestSpanExporter>;

const runtime = ManagedRuntime.make(TestLayer);

afterAll(() => runtime.dispose());

describe("BrowsingService traces", () => {
	beforeEach(() => {
		tabs = [];
		nextId = 0;
	});

	it("createTab traces full flow through tab feature", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const browsing = yield* BrowsingService;
				const exporter = yield* TestSpanExporter;
				exporter.reset();

				yield* browsing.createTab("https://example.com");

				// Allow spans to flush
				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				const expectedBrowsingSpan = spanName(BROWSING_SERVICE, "createTab");
				const expectedTabSpan = spanName(TAB_FEATURE, "create");

				assertContainsSpan(spans, expectedBrowsingSpan);
				assertContainsSpan(spans, expectedTabSpan);

				// Verify parent-child chain: TabFeature.create should be a child of BrowsingService.createTab
				const browsingSpan = spans.find((s: ReadableSpan) => s.name === expectedBrowsingSpan);
				const tabSpan = spans.find((s: ReadableSpan) => s.name === expectedTabSpan);

				expect(browsingSpan).toBeDefined();
				expect(tabSpan).toBeDefined();
				expect(tabSpan?.parentSpanContext?.spanId).toBe(browsingSpan?.spanContext().spanId);

				// Assert zero errors on all spans
				for (const span of spans) {
					expect(span.status.code).not.toBe(2); // SpanStatusCode.ERROR = 2
				}
			}),
		);
	});

	it("getTabs traces through tab feature", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const browsing = yield* BrowsingService;
				const exporter = yield* TestSpanExporter;
				exporter.reset();

				yield* browsing.getTabs();
				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				assertContainsSpan(spans, spanName(BROWSING_SERVICE, "getTabs"));
				assertContainsSpan(spans, spanName(TAB_FEATURE, "getAll"));
			}),
		);
	});

	it("removeTab traces through tab feature", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const browsing = yield* BrowsingService;
				const exporter = yield* TestSpanExporter;
				exporter.reset();

				yield* browsing.createTab("https://example.com");
				exporter.reset();

				yield* browsing.removeTab("1");
				yield* Effect.sleep(Duration.millis(10));

				const spans = exporter.getFinishedSpans();

				assertContainsSpan(spans, spanName(BROWSING_SERVICE, "removeTab"));
				assertContainsSpan(spans, spanName(TAB_FEATURE, "remove"));
			}),
		);
	});

	it("changes stream maps tab changes to BrowsingState", async () => {
		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const browsing = yield* BrowsingService;

				const fiber = yield* browsing.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));
				yield* browsing.createTab("https://example.com");

				const collected = yield* Fiber.join(fiber);
				return Chunk.toArray(collected);
			}),
		);

		expect(result).toHaveLength(1);
		expect(result[0].tabs).toHaveLength(1);
		expect(result[0].tabs[0].url).toBe("https://example.com");
	});
});
