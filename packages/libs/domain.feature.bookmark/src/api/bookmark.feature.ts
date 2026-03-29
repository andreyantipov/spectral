import type { DatabaseError } from "@ctrl/base.error";
import type { Bookmark } from "@ctrl/base.schema";
import { withTracing } from "@ctrl/base.tracing";
import { BookmarkRepository } from "@ctrl/core.contract.storage";
import { Context, Effect, Layer } from "effect";
import { BOOKMARK_FEATURE } from "../lib/constants";

export class BookmarkFeature extends Context.Tag(BOOKMARK_FEATURE)<
	BookmarkFeature,
	{
		readonly getAll: () => Effect.Effect<Bookmark[], DatabaseError>;
		readonly create: (url: string, title: string | null) => Effect.Effect<Bookmark, DatabaseError>;
		readonly remove: (id: string) => Effect.Effect<void, DatabaseError>;
		readonly isBookmarked: (url: string) => Effect.Effect<boolean, DatabaseError>;
	}
>() {}

export const BookmarkFeatureLive = Layer.effect(
	BookmarkFeature,
	Effect.gen(function* () {
		const repo = yield* BookmarkRepository;
		return withTracing(BOOKMARK_FEATURE, {
			getAll: () => repo.getAll(),
			create: (url: string, title: string | null) => repo.create(url, title),
			remove: (id: string) => repo.remove(id),
			isBookmarked: (url: string) => repo.findByUrl(url).pipe(Effect.map((b) => b !== undefined)),
		});
	}),
);
