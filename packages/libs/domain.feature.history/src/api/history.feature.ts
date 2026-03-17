import {
	type DatabaseError,
	type HistoryEntry,
	HistoryRepository,
	makeFeatureService,
} from "@ctrl/core.shared";
import { Context, Effect, type Stream } from "effect";
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

export const HistoryFeatureLive = makeFeatureService({
	tag: HistoryFeature,
	repoTag: HistoryRepository,
	name: HISTORY_FEATURE,
	extend: (repo, notify) => ({
		record: (url: string, title: string | null) =>
			repo.record(url, title).pipe(Effect.tap(() => notify())),
		clear: () => repo.clear().pipe(Effect.tap(() => notify())),
	}),
});
