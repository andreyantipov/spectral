import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const bookmarksTable = sqliteTable("bookmarks", {
	id: text("id").primaryKey(),
	url: text("url").notNull(),
	title: text("title"),
	createdAt: text("createdAt").notNull(),
});
