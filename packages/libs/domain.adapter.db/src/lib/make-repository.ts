import { withTracing } from "@ctrl/core.shared";
import type { SQL } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTableWithColumns, TableConfig } from "drizzle-orm/sqlite-core";

type TableWithId = { id: AnySQLiteColumn };

type Chainable = { where: (condition: SQL) => unknown };

type DrizzleDb<T> = {
	select: () => { from: (t: T) => Chainable };
	insert: (t: T) => { values: (v: Record<string, unknown>) => unknown };
	update: (t: T) => { set: (v: Record<string, unknown>) => Chainable };
	delete: (t: T) => Chainable;
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
			getAll: () => db.select().from(table),
			getById: (id: string) => db.select().from(table).where(eq(table.id, id)),
			create: (values: typeof table.$inferInsert) => db.insert(table).values(values),
			update: (id: string, values: Partial<typeof table.$inferInsert>) =>
				db
					.update(table)
					.set(values as Record<string, unknown>)
					.where(eq(table.id, id)),
			remove: (id: string) => db.delete(table).where(eq(table.id, id)),
		});
