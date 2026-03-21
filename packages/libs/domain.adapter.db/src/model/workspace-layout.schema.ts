import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaceLayoutTable = sqliteTable("workspace_layout", {
	id: text("id").primaryKey().default("default"),
	version: integer("version").notNull().default(1),
	dockviewState: text("dockviewState").notNull().default("{}"),
	updatedAt: text("updatedAt").notNull(),
});
