import { DatabaseError } from "@ctrl/base.error";
import type { HistoryEntry } from "@ctrl/base.schema";
import { withTracing } from "@ctrl/base.tracing";
import { HistoryRepository } from "@ctrl/arch.contract.storage";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { desc, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { historyTable } from "../model/history.schema";

export const HistoryRepositoryLive = Layer.effect(
	HistoryRepository,
	Effect.gen(function* () {
		const db = yield* SqliteDrizzle;

		const now = () => new Date().toISOString();
		const genId = () => crypto.randomUUID();

		const toHistoryEntry = (row: typeof historyTable.$inferSelect): HistoryEntry => ({
			id: row.id,
			url: row.url,
			title: row.title,
			query: row.query ?? null,
			visitedAt: row.visitedAt,
		});

		return withTracing("HistoryRepository", {
			getAll: () =>
				db
					.select()
					.from(historyTable)
					.orderBy(desc(historyTable.visitedAt), desc(sql`rowid`))
					.pipe(
						Effect.map((rows) => rows.map(toHistoryEntry)),
						Effect.catchAll((cause) =>
							Effect.fail(
								new DatabaseError({ message: "Failed to get all history entries", cause }),
							),
						),
					),

			record: (url: string, title: string | null, query: string | null = null) =>
				Effect.gen(function* () {
					const id = genId();
					const visitedAt = now();
					const values = { id, url, title, query, visitedAt };
					yield* db.insert(historyTable).values(values);
					return toHistoryEntry(values);
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to record history entry", cause })),
					),
				),

			clear: () =>
				db.delete(historyTable).pipe(
					Effect.asVoid,
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to clear history", cause })),
					),
				),
		});
	}),
);
