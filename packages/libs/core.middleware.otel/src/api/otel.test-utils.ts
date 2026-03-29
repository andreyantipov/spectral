import { NodeSdk } from "@effect/opentelemetry";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Context, Layer } from "effect";

export const TEST_SPAN_EXPORTER_ID = "TestSpanExporter" as const;

export class TestSpanExporter extends Context.Tag(TEST_SPAN_EXPORTER_ID)<
	TestSpanExporter,
	{
		readonly getFinishedSpans: () => readonly ReadableSpan[];
		readonly reset: () => void;
	}
>() {}

const makeTestSpanExporterLayer = (): Layer.Layer<TestSpanExporter> => {
	const exporter = new InMemorySpanExporter();
	const sdkLayer = NodeSdk.layer(() => ({
		spanProcessor: new SimpleSpanProcessor(exporter),
	}));
	return Layer.merge(
		sdkLayer,
		Layer.succeed(TestSpanExporter, {
			getFinishedSpans: () => exporter.getFinishedSpans(),
			reset: () => exporter.reset(),
		}),
	);
};

export const TestSpanExporterLive: Layer.Layer<TestSpanExporter> = makeTestSpanExporterLayer();

export const assertContainsSpan = (spans: readonly ReadableSpan[], expectedName: string) => {
	const found = spans.some((span) => span.name === expectedName);
	if (!found) {
		const names = spans.map((s) => s.name).join(", ");
		throw new Error(`Expected spans to contain "${expectedName}" but found: [${names}]`);
	}
};
