import { LibsqlClient } from "@effect/sql-libsql";
import { Effect } from "effect";

/**
 * Ensures the database schema exists.
 * Raw SQL is acceptable here — this is the canonical migration entry-point
 * inside domain.adapter.db.
 */
export const ensureSchema = Effect.gen(function* () {
	const sql = yield* LibsqlClient.LibsqlClient;
	yield* sql`
		CREATE TABLE IF NOT EXISTS tabs (
			id TEXT PRIMARY KEY,
			url TEXT NOT NULL,
			title TEXT,
			position INTEGER NOT NULL DEFAULT 0,
			isActive INTEGER NOT NULL DEFAULT 0,
			createdAt TEXT NOT NULL,
			updatedAt TEXT NOT NULL
		)
	`;
});
