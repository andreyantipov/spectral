import { DatabaseError } from "@ctrl/core.base.errors";
import { withTracing } from "@ctrl/core.base.tracing";
import { type Bookmark, BookmarkRepository } from "@ctrl/core.shared";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { desc, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { bookmarksTable } from "../model/bookmarks.schema";

export const BookmarkRepositoryLive = Layer.effect(
	BookmarkRepository,
	Effect.gen(function* () {
		const db = yield* SqliteDrizzle;

		const now = () => new Date().toISOString();
		const genId = () => crypto.randomUUID();

		const toBookmark = (row: typeof bookmarksTable.$inferSelect): Bookmark => ({
			id: row.id,
			url: row.url,
			title: row.title,
			createdAt: row.createdAt,
		});

		return withTracing("BookmarkRepository", {
			getAll: () =>
				db
					.select()
					.from(bookmarksTable)
					.orderBy(desc(bookmarksTable.createdAt))
					.pipe(
						Effect.map((rows) => rows.map(toBookmark)),
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to get all bookmarks", cause })),
						),
					),

			create: (url: string, title: string | null) =>
				Effect.gen(function* () {
					const id = genId();
					const createdAt = now();
					const values = { id, url, title, createdAt };
					yield* db.insert(bookmarksTable).values(values);
					return toBookmark(values);
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to create bookmark", cause })),
					),
				),

			remove: (id: string) =>
				db
					.delete(bookmarksTable)
					.where(eq(bookmarksTable.id, id))
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to remove bookmark", cause })),
						),
					),

			findByUrl: (url: string) =>
				db
					.select()
					.from(bookmarksTable)
					.where(eq(bookmarksTable.url, url))
					.pipe(
						Effect.map((rows) => (rows.length > 0 ? toBookmark(rows[0]) : undefined)),
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to find bookmark by url", cause })),
						),
					),
		});
	}),
);
