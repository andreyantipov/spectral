import { StateSync } from "@ctrl/arch.contract.state-sync";
import { Effect, Layer, Ref } from "effect";

type SnapshotProvider = () => Effect.Effect<unknown>;

export const StateSyncLive = Layer.effect(
	StateSync,
	Effect.gen(function* () {
		const providers = yield* Ref.make<Map<string, SnapshotProvider>>(new Map());

		return {
			register: (path: string, snapshot: SnapshotProvider) =>
				Ref.update(providers, (m) => new Map(m).set(path, snapshot)),

			getSnapshot: () =>
				Effect.gen(function* () {
					const m = yield* Ref.get(providers);
					const entries: [string, unknown][] = [];
					for (const [path, fn] of m) {
						entries.push([path, yield* fn()]);
					}
					return Object.fromEntries(entries);
				}),
		};
	}),
);
