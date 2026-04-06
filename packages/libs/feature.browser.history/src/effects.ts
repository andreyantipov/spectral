import { historyTable } from "@ctrl/base.model.history";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { Effect } from "effect";

// Effect key matching WebSession spec (PascalCase)
const RecordHistory = "RecordHistory";

export const historyEffects = Effect.gen(function* () {
	const db = yield* SqliteDrizzle;

	return {
		[RecordHistory]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const url = p.url as string;
				const title = (p.title as string) ?? null;
				yield* db.insert(historyTable).values({
					id: crypto.randomUUID(),
					url,
					title,
					query: null,
					visitedAt: new Date().toISOString(),
				});
			}),
	};
});
