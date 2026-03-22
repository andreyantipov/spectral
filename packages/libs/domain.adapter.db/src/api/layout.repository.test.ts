import { LayoutRepository } from "@ctrl/core.port.storage";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { LibsqlClient } from "@effect/sql-libsql";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { ensureSchema } from "./ensure-schema";
import { LayoutRepositoryLive } from "./layout.repository";

const makeTestLayer = () => {
	const DbLive = LibsqlClient.layer({ url: "file::memory:" });
	const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbLive));
	const SetupLive = Layer.effectDiscard(ensureSchema).pipe(Layer.provide(DbLive));

	return LayoutRepositoryLive.pipe(
		Layer.provide(DrizzleLive),
		Layer.provide(DbLive),
		Layer.provide(SetupLive),
	);
};

const runTest = <A, E>(effect: Effect.Effect<A, E, LayoutRepository>) =>
	Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer())));

describe("LayoutRepository", () => {
	it("returns null when no layout saved", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* LayoutRepository;
				return yield* repo.getLayout();
			}),
		);
		expect(result).toBeNull();
	});

	it("saves and retrieves layout", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* LayoutRepository;
				yield* repo.saveLayout({
					version: 1,
					dockviewState: { panels: [{ id: "p1", type: "session" }] },
				});
				return yield* repo.getLayout();
			}),
		);
		expect(result).not.toBeNull();
		expect(result?.version).toBe(1);
		expect(result?.dockviewState).toEqual({ panels: [{ id: "p1", type: "session" }] });
	});

	it("overwrites existing layout on save", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* LayoutRepository;
				yield* repo.saveLayout({ version: 1, dockviewState: { panels: [] } });
				yield* repo.saveLayout({ version: 2, dockviewState: { panels: [{ id: "p1" }] } });
				return yield* repo.getLayout();
			}),
		);
		expect(result?.version).toBe(2);
		expect(result?.dockviewState).toEqual({ panels: [{ id: "p1" }] });
	});
});
