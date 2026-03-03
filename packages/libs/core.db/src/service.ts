import { Context, Effect, Layer } from "effect";
import { type Database, type DatabaseConfig, createDatabase } from "./client";
import { DatabaseError } from "./errors";

export class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly db: Database;
    readonly query: <A>(
      f: (db: Database) => Promise<A>,
    ) => Effect.Effect<A, DatabaseError>;
    readonly transaction: <A>(
      f: (tx: Database) => Promise<A>,
    ) => Effect.Effect<A, DatabaseError>;
  }
>() {}

export const DatabaseServiceLive = (config: DatabaseConfig) =>
  Layer.sync(DatabaseService, () => {
    const db = createDatabase(config);

    return {
      db,
      query: <A>(f: (db: Database) => Promise<A>) =>
        Effect.tryPromise({
          try: () => f(db),
          catch: (cause) =>
            new DatabaseError({ reason: "Query failed", cause }),
        }),
      transaction: <A>(f: (tx: Database) => Promise<A>) =>
        Effect.tryPromise({
          try: () => db.transaction((tx) => f(tx as unknown as Database)),
          catch: (cause) =>
            new DatabaseError({ reason: "Transaction failed", cause }),
        }),
    };
  });
