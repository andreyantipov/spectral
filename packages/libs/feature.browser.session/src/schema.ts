import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessionsTable = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	mode: text("mode").notNull().default("visual"),
	isActive: integer("isActive", { mode: "boolean" }).notNull().default(false),
	currentIndex: integer("currentIndex").notNull().default(0),
	createdAt: text("createdAt").notNull(),
	updatedAt: text("updatedAt").notNull(),
});

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
