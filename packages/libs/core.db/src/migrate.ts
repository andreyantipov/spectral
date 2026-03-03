import { Effect } from "effect";
import { sql } from "drizzle-orm";
import { DatabaseService } from "./service";
import { DatabaseError } from "./errors";

export const ensureTabsTable: Effect.Effect<void, DatabaseError, DatabaseService> =
  Effect.gen(function* () {
    const { query } = yield* DatabaseService;
    yield* query((db) =>
      db.run(sql`
        CREATE TABLE IF NOT EXISTS tabs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT 'New Tab',
          position INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (current_timestamp),
          updated_at TEXT NOT NULL DEFAULT (current_timestamp)
        )
      `),
    );
  });
