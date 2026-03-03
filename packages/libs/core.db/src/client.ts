import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type DatabaseConfig = {
  readonly url: string;
  readonly authToken?: string;
};

export type Database = LibSQLDatabase<typeof schema>;

export function createDatabase(config: DatabaseConfig): Database {
  return drizzle({
    connection: {
      url: config.url,
      authToken: config.authToken,
    },
    schema,
  });
}
