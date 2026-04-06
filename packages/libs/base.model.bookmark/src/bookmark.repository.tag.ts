import type { DatabaseError } from "@ctrl/base.error";
import type { Bookmark } from "@ctrl/base.schema";
import { Context, type Effect } from "effect";

export const BOOKMARK_REPOSITORY_ID = "BookmarkRepository" as const;

export class BookmarkRepository extends Context.Tag(BOOKMARK_REPOSITORY_ID)<
	BookmarkRepository,
	{
		readonly getAll: () => Effect.Effect<Bookmark[], DatabaseError>;
		readonly create: (url: string, title: string | null) => Effect.Effect<Bookmark, DatabaseError>;
		readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly findByUrl: (url: string) => Effect.Effect<Bookmark | undefined, DatabaseError>;
	}
>() {}
