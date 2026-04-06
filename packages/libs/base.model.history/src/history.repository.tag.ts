import type { DatabaseError } from "@ctrl/base.error";
import type { HistoryEntry } from "@ctrl/base.schema";
import { Context, type Effect } from "effect";

export const HISTORY_REPOSITORY_ID = "HistoryRepository" as const;

export class HistoryRepository extends Context.Tag(HISTORY_REPOSITORY_ID)<
	HistoryRepository,
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
