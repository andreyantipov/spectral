import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pages = sqliteTable("pages", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	title: text("title").notNull(),
	url: text("url").notNull(),
	createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
	updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

export const tabs = sqliteTable("tabs", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	url: text("url").notNull(),
	title: text("title").notNull().default("New Tab"),
	position: integer("position").notNull().default(0),
	isActive: integer("is_active").notNull().default(0),
	createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
	updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});
