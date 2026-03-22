import type { DatabaseError } from "@ctrl/core.base.errors";
import type { Bookmark } from "@ctrl/core.base.model";
import { BookmarkRepository, makeFeatureService } from "@ctrl/core.port.storage";
import { Context, Effect, type Stream } from "effect";
import { BOOKMARK_FEATURE } from "../lib/constants";

export class BookmarkFeature extends Context.Tag(BOOKMARK_FEATURE)<
	BookmarkFeature,
	{
		readonly getAll: () => Effect.Effect<Bookmark[], DatabaseError>;
		readonly create: (url: string, title: string | null) => Effect.Effect<Bookmark, DatabaseError>;
		readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly isBookmarked: (url: string) => Effect.Effect<boolean, DatabaseError>;
		readonly changes: Stream.Stream<Bookmark[]>;
	}
>() {}

export const BookmarkFeatureLive = makeFeatureService({
	tag: BookmarkFeature,
	repoTag: BookmarkRepository,
	name: BOOKMARK_FEATURE,
	extend: (repo, notify) => ({
		create: (url: string, title: string | null) =>
			repo.create(url, title).pipe(Effect.tap(() => notify())),
		remove: (id: string) => repo.remove(id).pipe(Effect.tap(() => notify())),
		isBookmarked: (url: string) => repo.findByUrl(url).pipe(Effect.map((b) => b !== undefined)),
	}),
});
