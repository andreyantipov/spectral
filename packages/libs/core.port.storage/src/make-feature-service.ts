import { withTracing } from "@ctrl/core.base.tracing";
import { type Context, Effect, Layer, PubSub, Stream } from "effect";

/**
 * Factory for creating feature services with PubSub reactivity.
 * Handles the common pattern: repository -> PubSub -> notify-on-mutate -> Stream.
 * Custom methods are added via the `extend` callback.
 */
export const makeFeatureService = <
	Item,
	TagId,
	TagService extends {
		readonly getAll: () => Effect.Effect<Item[], unknown>;
		readonly changes: Stream.Stream<Item[]>;
	},
	RepoId,
	RepoService extends { readonly getAll: () => Effect.Effect<Item[], unknown> },
	Ext extends Record<string, unknown>,
>(config: {
	readonly tag: Context.Tag<TagId, TagService>;
	readonly repoTag: Context.Tag<RepoId, RepoService>;
	readonly name: string;
	readonly extend: (repo: RepoService, notify: () => Effect.Effect<void, never, never>) => Ext;
}) =>
	Layer.effect(
		config.tag,
		Effect.gen(function* () {
			const repo = yield* config.repoTag;
			const pubsub = yield* PubSub.unbounded<Item[]>();

			const notify = () =>
				repo.getAll().pipe(
					Effect.flatMap((items) => PubSub.publish(pubsub, items)),
					Effect.ignore,
				);

			const extended = config.extend(repo, notify);

			return withTracing(config.name, {
				getAll: () => repo.getAll(),
				...extended,
				changes: Stream.fromPubSub(pubsub),
			}) as unknown as TagService;
		}),
	);
