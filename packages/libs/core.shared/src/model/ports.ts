/**
 * @deprecated Storage ports will move to `@ctrl/core.ports.storage` in Phase 2.
 * New code should prepare for the migration but continue importing from here for now.
 * See: docs/superpowers/specs/2026-03-22-event-driven-architecture-design.md
 */
import { Context, type Effect } from "effect";
import type { AppCommand } from "./commands";
import type { DatabaseError } from "./errors";
import type { Bookmark, HistoryEntry, Page, Session } from "./schemas";

export const DATABASE_SERVICE_ID = "DatabaseService" as const;
export const SESSION_REPOSITORY_ID = "SessionRepository" as const;
export const BOOKMARK_REPOSITORY_ID = "BookmarkRepository" as const;
export const HISTORY_REPOSITORY_ID = "HistoryRepository" as const;
export const LAYOUT_REPOSITORY_ID = "LayoutRepository" as const;

export class DatabaseService extends Context.Tag(DATABASE_SERVICE_ID)<
	DatabaseService,
	{
		readonly query: <A>(f: (db: unknown) => Promise<A>) => Effect.Effect<A, DatabaseError>;
		readonly transaction: <A>(f: (db: unknown) => Promise<A>) => Effect.Effect<A, DatabaseError>;
	}
>() {}

export class BookmarkRepository extends Context.Tag(BOOKMARK_REPOSITORY_ID)<
	BookmarkRepository,
	{
		readonly getAll: () => Effect.Effect<Bookmark[], DatabaseError>;
		readonly create: (url: string, title: string | null) => Effect.Effect<Bookmark, DatabaseError>;
		readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly findByUrl: (url: string) => Effect.Effect<Bookmark | undefined, DatabaseError>;
	}
>() {}

export class HistoryRepository extends Context.Tag(HISTORY_REPOSITORY_ID)<
	HistoryRepository,
	{
		readonly getAll: () => Effect.Effect<HistoryEntry[], DatabaseError>;
		readonly record: (
			url: string,
			title: string | null,
			query?: string | null,
		) => Effect.Effect<HistoryEntry, DatabaseError>;
		readonly clear: () => Effect.Effect<void, DatabaseError>;
	}
>() {}

export const IPC_BRIDGE_ID = "IpcBridge" as const;

export class IpcBridge extends Context.Tag(IPC_BRIDGE_ID)<
	IpcBridge,
	{
		readonly send: (command: AppCommand) => void;
		readonly subscribe: (handler: (command: AppCommand) => void) => () => void;
	}
>() {}

export class LayoutRepository extends Context.Tag(LAYOUT_REPOSITORY_ID)<
	LayoutRepository,
	{
		readonly getLayout: () => Effect.Effect<
			{ version: number; dockviewState: unknown } | null,
			DatabaseError
		>;
		readonly saveLayout: (layout: {
			version: number;
			dockviewState: unknown;
		}) => Effect.Effect<void, DatabaseError>;
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
		readonly updatePageUrl: (
			sessionId: string,
			pageIndex: number,
			url: string,
		) => Effect.Effect<void, DatabaseError>;
	}
>() {}
