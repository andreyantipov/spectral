import { asc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import type { DatabaseError } from "./errors";
import { tabs } from "./schema";
import { DatabaseService } from "./service";

export type Tab = {
	readonly id: number;
	readonly url: string;
	readonly title: string;
	readonly position: number;
	readonly isActive: number;
};

export class TabService extends Context.Tag("TabService")<
	TabService,
	{
		readonly getAll: () => Effect.Effect<Tab[], DatabaseError>;
		readonly create: (url: string, title?: string) => Effect.Effect<Tab, DatabaseError>;
		readonly remove: (id: number) => Effect.Effect<void, DatabaseError>;
		readonly update: (
			id: number,
			data: Partial<Pick<Tab, "url" | "title" | "position">>,
		) => Effect.Effect<void, DatabaseError>;
		readonly setActive: (id: number) => Effect.Effect<void, DatabaseError>;
		readonly getActive: () => Effect.Effect<Tab | undefined, DatabaseError>;
	}
>() {}

export const TabServiceLive = Layer.effect(
	TabService,
	Effect.gen(function* () {
		const { query } = yield* DatabaseService;

		return {
			getAll: () => query((db) => db.select().from(tabs).orderBy(asc(tabs.position))),

			create: (url: string, title?: string) =>
				query(async (db) => {
					const all = await db.select().from(tabs).orderBy(asc(tabs.position));
					const nextPosition = all.length > 0 ? all[all.length - 1].position + 1 : 0;
					const result = await db
						.insert(tabs)
						.values({
							url,
							title: title ?? "New Tab",
							position: nextPosition,
						})
						.returning();
					return result[0];
				}),

			remove: (id: number) =>
				query(async (db) => {
					await db.delete(tabs).where(eq(tabs.id, id));
				}),

			update: (id: number, data: Partial<Pick<Tab, "url" | "title" | "position">>) =>
				query(async (db) => {
					await db.update(tabs).set(data).where(eq(tabs.id, id));
				}),

			setActive: (id: number) =>
				query(async (db) => {
					await db.update(tabs).set({ isActive: 0 });
					await db.update(tabs).set({ isActive: 1 }).where(eq(tabs.id, id));
				}),

			getActive: () =>
				query(async (db) => {
					const result = await db.select().from(tabs).where(eq(tabs.isActive, 1)).limit(1);
					return result[0];
				}),
		};
	}),
);
