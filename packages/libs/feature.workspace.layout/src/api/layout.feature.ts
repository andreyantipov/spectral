import { withTracing } from "@ctrl/base.tracing";
import { LayoutRepository } from "@ctrl/core.contract.storage";
import { Context, Effect, Layer } from "effect";
import { LAYOUT_FEATURE } from "../lib/constants";
import { makeGroupNode } from "../lib/tree-ops";
import type { LayoutNode, PersistedLayout } from "../model/layout.validators";

const DEFAULT_LAYOUT: LayoutNode = makeGroupNode([], "");

export class LayoutFeature extends Context.Tag(LAYOUT_FEATURE)<
	LayoutFeature,
	{
		readonly getLayout: () => Effect.Effect<LayoutNode>;
		readonly getPersistedLayout: () => Effect.Effect<PersistedLayout | null>;
		readonly updateLayout: (layout: PersistedLayout) => Effect.Effect<void>;
	}
>() {}

export const LayoutFeatureLive = Layer.effect(
	LayoutFeature,
	Effect.gen(function* () {
		const repo = yield* LayoutRepository;

		return withTracing(LAYOUT_FEATURE, {
			getLayout: () =>
				repo.getLayout().pipe(
					Effect.map((persisted) => (persisted ? persisted.root : DEFAULT_LAYOUT)),
					Effect.catchAll(() => Effect.succeed(DEFAULT_LAYOUT)),
				),

			getPersistedLayout: () => repo.getLayout().pipe(Effect.catchAll(() => Effect.succeed(null))),

			updateLayout: (layout: PersistedLayout) =>
				repo.saveLayout(layout).pipe(Effect.catchAll(() => Effect.void)),
		});
	}),
);
