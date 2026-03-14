import { type Tab, TabRepository } from "@ctrl/core.shared";
import { type TestSpanExporter, TestSpanExporterLive } from "@ctrl/domain.adapter.otel";
import { TabFeatureLive } from "@ctrl/domain.feature.session";
import { type BrowsingService, BrowsingServiceLive } from "@ctrl/domain.service.browsing";
import { Effect, Layer } from "effect";

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

export const MockTabRepositoryLive = Layer.succeed(TabRepository, {
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

export const resetMockTabs = () => {
	tabs = [];
	nextId = 0;
};

export const PipelineTestLayer = BrowsingServiceLive.pipe(
	Layer.provide(TabFeatureLive),
	Layer.provide(MockTabRepositoryLive),
	Layer.provideMerge(TestSpanExporterLive),
) as Layer.Layer<BrowsingService | TestSpanExporter>;
