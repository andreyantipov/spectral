import { Effects } from "@ctrl/base.op.browsing";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { Effect } from "effect";
import { historyTable } from "./schema";

export const historyEffects = Effect.gen(function* () {
	const db = yield* SqliteDrizzle;

	return {
		[Effects.HISTORY_RECORD]: (p: Record<string, unknown>) =>
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
