import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const historyTable = sqliteTable("history", {
	id: text("id").primaryKey(),
	url: text("url").notNull(),
	title: text("title"),
	query: text("query"),
	visitedAt: text("visitedAt").notNull(),
});
