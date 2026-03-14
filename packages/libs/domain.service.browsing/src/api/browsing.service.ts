import { type DatabaseError, type Tab, withTracing } from "@ctrl/core.shared";
import { TabFeature } from "@ctrl/domain.feature.tab";
import { Context, Effect, Layer, Stream } from "effect";
import { BROWSING_SERVICE } from "../lib/constants";
import type { BrowsingState } from "../model/browsing.events";

export const BROWSING_SERVICE_ID = "BrowsingService" as const;

export class BrowsingService extends Context.Tag(BROWSING_SERVICE_ID)<
	BrowsingService,
	{
		readonly createTab: (url: string) => Effect.Effect<Tab, DatabaseError>;
		readonly removeTab: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly getTabs: () => Effect.Effect<Tab[], DatabaseError>;
		readonly changes: Stream.Stream<BrowsingState>;
	}
>() {}

export const BrowsingServiceLive = Layer.effect(
	BrowsingService,
	Effect.gen(function* () {
		const tabs = yield* TabFeature;

		return withTracing(BROWSING_SERVICE, {
			createTab: (url: string) => tabs.create(url),
			removeTab: (id: string) => tabs.remove(id),
			getTabs: () => tabs.getAll(),
			// When history is added, this becomes Stream.combineLatest
			changes: tabs.changes.pipe(Stream.map((tabs): BrowsingState => ({ tabs }))),
		});
	}),
);
