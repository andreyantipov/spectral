import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const historyTable = sqliteTable("history", {
	id: text("id").primaryKey(),
	url: text("url").notNull(),
	title: text("title"),
	visitedAt: text("visitedAt").notNull(),
});
