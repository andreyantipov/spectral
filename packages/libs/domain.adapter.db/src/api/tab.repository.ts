import { DatabaseError, type Tab, TabRepository, withTracing } from "@ctrl/core.shared";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { eq, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { tabsTable } from "../model/tabs.schema";

export const TabRepositoryLive = Layer.effect(
	TabRepository,
	Effect.gen(function* () {
		const db = yield* SqliteDrizzle;

		const now = () => new Date().toISOString();
		const genId = () => crypto.randomUUID();

		return withTracing("TabRepository", {
			getAll: () =>
				db
					.select()
					.from(tabsTable)
					.pipe(
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to get all tabs", cause })),
						),
					),

			create: (url: string) =>
				Effect.gen(function* () {
					const id = genId();
					const timestamp = now();
					const values = {
						id,
						url,
						title: null,
						position: 0,
						isActive: false,
						createdAt: timestamp,
						updatedAt: timestamp,
					};
					yield* db.insert(tabsTable).values(values);
					return values;
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to create tab", cause })),
					),
				),

			remove: (id: string) =>
				db
					.delete(tabsTable)
					.where(eq(tabsTable.id, id))
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to remove tab", cause })),
						),
					),

			update: (id: string, data: Partial<Tab>) =>
				db
					.update(tabsTable)
					.set({ ...data, updatedAt: now() })
					.where(eq(tabsTable.id, id))
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to update tab", cause })),
						),
					),

			getActive: () =>
				db
					.select()
					.from(tabsTable)
					.where(eq(tabsTable.isActive, true))
					.pipe(
						Effect.map((rows) => rows[0] as (typeof rows)[0] | undefined),
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to get active tab", cause })),
						),
					),

			setActive: (id: string) =>
				db
					.update(tabsTable)
					.set({
						isActive: sql`(${tabsTable.id} = ${id})`,
						updatedAt: now(),
					})
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to set active tab", cause })),
						),
					),
		});
	}),
);
