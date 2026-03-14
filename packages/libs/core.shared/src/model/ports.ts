import { Context, type Effect } from "effect";
import type { DatabaseError } from "./errors";
import type { Tab } from "./types";

export const DATABASE_SERVICE_ID = "DatabaseService" as const;
export const TAB_REPOSITORY_ID = "TabRepository" as const;

export class DatabaseService extends Context.Tag(DATABASE_SERVICE_ID)<
	DatabaseService,
	{
		// biome-ignore lint/suspicious/noExplicitAny: db handle is opaque at port level
		readonly query: <A>(f: (db: any) => Promise<A>) => Effect.Effect<A, DatabaseError>;
		// biome-ignore lint/suspicious/noExplicitAny: db handle is opaque at port level
		readonly transaction: <A>(f: (db: any) => Promise<A>) => Effect.Effect<A, DatabaseError>;
	}
>() {}

export class TabRepository extends Context.Tag(TAB_REPOSITORY_ID)<
	TabRepository,
	{
		readonly getAll: () => Effect.Effect<Tab[], DatabaseError>;
		readonly create: (url: string) => Effect.Effect<Tab, DatabaseError>;
		readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly update: (id: string, data: Partial<Tab>) => Effect.Effect<void, DatabaseError>;
		readonly getActive: () => Effect.Effect<Tab | undefined, DatabaseError>;
		readonly setActive: (id: string) => Effect.Effect<void, DatabaseError>;
	}
>() {}
