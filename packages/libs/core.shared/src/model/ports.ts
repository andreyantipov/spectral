import { Context, type Effect } from "effect";
import type { DatabaseError } from "./errors";
import type { Page, Session } from "./schemas";

export const DATABASE_SERVICE_ID = "DatabaseService" as const;
export const SESSION_REPOSITORY_ID = "SessionRepository" as const;

export class DatabaseService extends Context.Tag(DATABASE_SERVICE_ID)<
	DatabaseService,
	{
		readonly query: <A>(f: (db: unknown) => Promise<A>) => Effect.Effect<A, DatabaseError>;
		readonly transaction: <A>(f: (db: unknown) => Promise<A>) => Effect.Effect<A, DatabaseError>;
	}
>() {}

export class SessionRepository extends Context.Tag(SESSION_REPOSITORY_ID)<
	SessionRepository,
	{
		// Session CRUD
		readonly getAll: () => Effect.Effect<Session[], DatabaseError>;
		readonly getById: (id: string) => Effect.Effect<Session | undefined, DatabaseError>;
		readonly create: (mode: "visual") => Effect.Effect<Session, DatabaseError>;
		readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly setActive: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly updateCurrentIndex: (id: string, index: number) => Effect.Effect<void, DatabaseError>;
		// Page CRUD
		readonly addPage: (
			sessionId: string,
			url: string,
			atIndex: number,
		) => Effect.Effect<Page, DatabaseError>;
		readonly removePagesAfterIndex: (
			sessionId: string,
			index: number,
		) => Effect.Effect<void, DatabaseError>;
		readonly updatePageTitle: (
			sessionId: string,
			pageIndex: number,
			title: string,
		) => Effect.Effect<void, DatabaseError>;
	}
>() {}
