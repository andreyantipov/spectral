import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sessionsTable } from "./sessions.schema";

export const pagesTable = sqliteTable("pages", {
	id: text("id").primaryKey(),
	sessionId: text("sessionId")
		.notNull()
		.references(() => sessionsTable.id, { onDelete: "cascade" }),
	url: text("url").notNull(),
	title: text("title"),
	pageIndex: integer("pageIndex").notNull(),
	loadedAt: text("loadedAt").notNull(),
});
