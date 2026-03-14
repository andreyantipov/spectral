import { withTracing } from "@ctrl/core.shared";
import { eq } from "drizzle-orm";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";

export const makeRepository =
	// biome-ignore lint/suspicious/noExplicitAny: Drizzle SQLiteTableWithColumns requires `any` for its config generic
		<T extends SQLiteTableWithColumns<any>>(table: T) =>
		// biome-ignore lint/suspicious/noExplicitAny: db handle is opaque — typed at call-site
		(db: any) =>
			// biome-ignore lint/suspicious/noExplicitAny: cast needed to access drizzle internal symbol
			withTracing(((table as any)[Symbol.for("drizzle:Name")] as string) ?? "unknown", {
				getAll: () => db.select().from(table),
				getById: (id: string) =>
					db
						.select()
						.from(table)
						// biome-ignore lint/suspicious/noExplicitAny: Drizzle column access requires cast
						.where(eq((table as any).id, id)),
				create: (values: typeof table.$inferInsert) => db.insert(table).values(values),
				update: (id: string, values: Partial<typeof table.$inferInsert>) =>
					db
						.update(table)
						.set(values)
						// biome-ignore lint/suspicious/noExplicitAny: Drizzle column access requires cast
						.where(eq((table as any).id, id)),
				// biome-ignore lint/suspicious/noExplicitAny: Drizzle column access requires cast
				remove: (id: string) => db.delete(table).where(eq((table as any).id, id)),
			});
