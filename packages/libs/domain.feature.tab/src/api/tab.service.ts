import { type DatabaseError, type Tab, TabRepository, withTracing } from "@ctrl/core.shared";
import { Context, Effect, Layer, PubSub, Stream } from "effect";
import { TAB_FEATURE } from "../lib/constants";

export const TAB_FEATURE_ID = "TabFeature" as const;

export class TabFeature extends Context.Tag(TAB_FEATURE_ID)<
	TabFeature,
	{
		readonly getAll: () => Effect.Effect<Tab[], DatabaseError>;
		readonly create: (url: string) => Effect.Effect<Tab, DatabaseError>;
		readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly changes: Stream.Stream<Tab[]>;
	}
>() {}

export const TabFeatureLive = Layer.effect(
	TabFeature,
	Effect.gen(function* () {
		const repo = yield* TabRepository;
		const pubsub = yield* PubSub.unbounded<Tab[]>();

		const notify = () => repo.getAll().pipe(Effect.flatMap((tabs) => PubSub.publish(pubsub, tabs)));

		return withTracing(TAB_FEATURE, {
			getAll: () => repo.getAll(),
			create: (url: string) => repo.create(url).pipe(Effect.tap(() => notify())),
			remove: (id: string) => repo.remove(id).pipe(Effect.tap(() => notify())),
			changes: Stream.fromPubSub(pubsub),
		});
	}),
);
