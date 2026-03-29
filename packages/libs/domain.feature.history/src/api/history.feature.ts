import type { DatabaseError } from "@ctrl/base.error";
import type { HistoryEntry } from "@ctrl/base.schema";
import { withTracing } from "@ctrl/base.tracing";
import { HistoryRepository } from "@ctrl/core.contract.storage";
import { Context, Effect, Layer } from "effect";
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
	}
>() {}

export const HistoryFeatureLive = Layer.effect(
	HistoryFeature,
	Effect.gen(function* () {
		const repo = yield* HistoryRepository;
		return withTracing(HISTORY_FEATURE, {
			getAll: () => repo.getAll(),
			record: (url: string, title: string | null, query: string | null = null) =>
				repo.record(url, title, query),
			clear: () => repo.clear(),
		});
	}),
);
