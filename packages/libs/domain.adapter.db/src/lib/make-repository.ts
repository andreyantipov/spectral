import { withTracing } from "@ctrl/core.shared";
import type { SQL } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTableWithColumns, TableConfig } from "drizzle-orm/sqlite-core";

type TableWithId = { id: AnySQLiteColumn };

type SelectResult<T extends SQLiteTableWithColumns<TableConfig>> = T["$inferSelect"];

type Queryable<R> = R & { where: (condition: SQL) => R };

type DrizzleDb<T extends SQLiteTableWithColumns<TableConfig>> = {
	select: () => { from: (t: T) => Queryable<SelectResult<T>[]> };
	insert: (t: T) => { values: (v: Record<string, unknown>) => SelectResult<T> };
	update: (t: T) => { set: (v: Record<string, unknown>) => Queryable<SelectResult<T>[]> };
	delete: (t: T) => Queryable<SelectResult<T>[]>;
};

const DRIZZLE_NAME_SYMBOL = Symbol.for("drizzle:Name");

const getTableName = (table: object): string => {
	const record = table as Record<symbol, unknown>;
	return (record[DRIZZLE_NAME_SYMBOL] as string) ?? "unknown";
};

export const makeRepository =
	<T extends SQLiteTableWithColumns<TableConfig> & TableWithId>(table: T) =>
	(db: DrizzleDb<T>) =>
		withTracing(getTableName(table), {
			getAll: (): SelectResult<T>[] => db.select().from(table),
			getById: (id: string): SelectResult<T>[] => db.select().from(table).where(eq(table.id, id)),
			create: (values: typeof table.$inferInsert): SelectResult<T> =>
				db.insert(table).values(values),
			update: (id: string, values: Partial<typeof table.$inferInsert>): SelectResult<T>[] =>
				db
					.update(table)
					.set(values as Record<string, unknown>)
					.where(eq(table.id, id)),
			remove: (id: string): SelectResult<T>[] => db.delete(table).where(eq(table.id, id)),
		});
