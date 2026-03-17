import { type Bookmark, BookmarkRepository } from "@ctrl/core.shared";
import { Chunk, type Context, Duration, Effect, Fiber, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { BookmarkFeature, BookmarkFeatureLive } from "./bookmark.feature";

let nextId = 0;

const makeBookmark = (url: string, title: string | null): Bookmark => ({
	id: String(++nextId),
	url,
	title,
	createdAt: new Date().toISOString(),
});

const makeTestLayer = () => {
	let bookmarks: Bookmark[] = [];
	nextId = 0;

	const MockBookmarkRepository = Layer.succeed(BookmarkRepository, {
		getAll: () => Effect.succeed(bookmarks),
		create: (url: string, title: string | null) =>
			Effect.sync(() => {
				const bookmark = makeBookmark(url, title);
				bookmarks = [...bookmarks, bookmark];
				return bookmark;
			}),
		remove: (id: string) =>
			Effect.sync(() => {
				bookmarks = bookmarks.filter((b) => b.id !== id);
			}),
		findByUrl: (url: string) => Effect.succeed(bookmarks.find((b) => b.url === url)),
	} satisfies Context.Tag.Service<typeof BookmarkRepository>);

	return BookmarkFeatureLive.pipe(Layer.provide(MockBookmarkRepository));
};

const runTest = <A, E>(effect: Effect.Effect<A, E, BookmarkFeature>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("BookmarkFeature", () => {
	it("create() adds bookmark and publishes to changes stream", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* BookmarkFeature;

				const fiber = yield* feature.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));
				const created = yield* feature.create("https://example.com", "Example");

				const collected = yield* Fiber.join(fiber);
				const snapshots = Chunk.toArray(collected);

				expect(created.url).toBe("https://example.com");
				expect(created.title).toBe("Example");
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]).toHaveLength(1);
				expect(snapshots[0][0].url).toBe("https://example.com");
			}),
		);
	});

	it("remove() deletes bookmark and publishes", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* BookmarkFeature;
				const created = yield* feature.create("https://example.com", "Example");

				const fiber = yield* feature.changes.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));
				yield* feature.remove(created.id);

				const collected = yield* Fiber.join(fiber);
				const snapshots = Chunk.toArray(collected);

				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]).toHaveLength(0);
			}),
		);
	});

	it("getAll() returns all bookmarks", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* BookmarkFeature;
				yield* feature.create("https://a.com", "A");
				yield* feature.create("https://b.com", "B");

				const all = yield* feature.getAll();
				expect(all).toHaveLength(2);
				expect(all[0].url).toBe("https://a.com");
				expect(all[1].url).toBe("https://b.com");
			}),
		);
	});

	it("isBookmarked() returns true when URL exists", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* BookmarkFeature;
				yield* feature.create("https://example.com", null);

				const result = yield* feature.isBookmarked("https://example.com");
				expect(result).toBe(true);
			}),
		);
	});

	it("isBookmarked() returns false when URL does not exist", async () => {
		await runTest(
			Effect.gen(function* () {
				const feature = yield* BookmarkFeature;

				const result = yield* feature.isBookmarked("https://not-bookmarked.com");
				expect(result).toBe(false);
			}),
		);
	});
});
