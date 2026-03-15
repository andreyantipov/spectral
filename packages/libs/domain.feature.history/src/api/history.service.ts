import {
	type DatabaseError,
	type HistoryEntry,
	HistoryRepository,
	withTracing,
} from "@ctrl/core.shared";
import { Context, Effect, Layer, PubSub, Stream } from "effect";
import { HISTORY_FEATURE } from "../lib/constants";

export class HistoryFeature extends Context.Tag(HISTORY_FEATURE)<
	HistoryFeature,
	{
		readonly getAll: () => Effect.Effect<HistoryEntry[], DatabaseError>;
		readonly record: (
			url: string,
			title: string | null,
		) => Effect.Effect<HistoryEntry, DatabaseError>;
		readonly clear: () => Effect.Effect<void, DatabaseError>;
		readonly changes: Stream.Stream<HistoryEntry[]>;
	}
>() {}

export const HistoryFeatureLive = Layer.effect(
	HistoryFeature,
	Effect.gen(function* () {
		const repo = yield* HistoryRepository;
		const pubsub = yield* PubSub.unbounded<HistoryEntry[]>();

		const notify = () =>
			repo.getAll().pipe(Effect.flatMap((entries) => PubSub.publish(pubsub, entries)));

		return withTracing(HISTORY_FEATURE, {
			getAll: () => repo.getAll(),

			record: (url: string, title: string | null) =>
				repo.record(url, title).pipe(Effect.tap(() => notify().pipe(Effect.ignore))),

			clear: () => repo.clear().pipe(Effect.tap(() => notify().pipe(Effect.ignore))),

			changes: Stream.fromPubSub(pubsub),
		});
	}),
);
