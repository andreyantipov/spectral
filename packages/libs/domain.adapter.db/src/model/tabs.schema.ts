import type { Tab } from "@ctrl/core.shared";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tabsTable = sqliteTable("tabs", {
	id: text("id").primaryKey(),
	url: text("url").notNull(),
	title: text("title"),
	position: integer("position").notNull().default(0),
	isActive: integer("isActive", { mode: "boolean" }).notNull().default(false),
	createdAt: text("createdAt").notNull(),
	updatedAt: text("updatedAt").notNull(),
});

// Compile-time check: Drizzle inferred type must match domain type
type _InferredRow = typeof tabsTable.$inferSelect;
type _Check = _InferredRow extends Tab ? (Tab extends _InferredRow ? true : never) : never;
const _check: _Check = true;
void _check;
