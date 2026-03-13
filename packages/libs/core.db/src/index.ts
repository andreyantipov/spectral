export { createDatabase, type Database, type DatabaseConfig } from "./client";
export { DatabaseError } from "./errors";
export { ensureTabsTable } from "./migrate";
export * from "./schema";
export { DatabaseService, DatabaseServiceLive } from "./service";
export { type Tab, TabService, TabServiceLive } from "./tab-service";
