import type { DatabaseError } from "@ctrl/core.base.errors";
import type { HistoryEntry } from "@ctrl/core.base.model";
import { HistoryRepository, makeFeatureService } from "@ctrl/core.port.storage";
import { Context, Effect, type Stream } from "effect";
import { HISTORY_FEATURE } from "../lib/constants";

export class HistoryFeature extends Context.Tag(HISTORY_FEATURE)<
	HistoryFeature,
	{
		readonly getAll: () => Effect.Effect<HistoryEntry[], DatabaseError>;
		readonly record: (
			url: string,
			title: string | null,
			query?: string | null,
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
		record: (url: string, title: string | null, query: string | null = null) =>
			repo.record(url, title, query).pipe(Effect.tap(() => notify())),
		clear: () => repo.clear().pipe(Effect.tap(() => notify())),
	}),
});
