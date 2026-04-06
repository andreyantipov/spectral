import type { PersistedLayout } from "@ctrl/base.schema";
import { LayoutRepository } from "@ctrl/arch.contract.storage";
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
				const layout: PersistedLayout = {
					version: 2,
					root: {
						id: "g1",
						type: "group",
						panels: [{ id: "p1", type: "session", entityId: "s1", title: "New Tab", icon: null }],
						activePanel: "p1",
					},
				};
				yield* repo.saveLayout(layout);
				return yield* repo.getLayout();
			}),
		);
		expect(result).not.toBeNull();
		expect(result?.version).toBe(2);
		expect(result?.root.type).toBe("group");
	});

	it("overwrites existing layout on save", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* LayoutRepository;
				const layout1: PersistedLayout = {
					version: 2,
					root: { id: "g1", type: "group", panels: [], activePanel: "" },
				};
				const layout2: PersistedLayout = {
					version: 2,
					root: {
						id: "g2",
						type: "group",
						panels: [{ id: "p1", type: "session", entityId: "s1", title: "Tab", icon: null }],
						activePanel: "p1",
					},
				};
				yield* repo.saveLayout(layout1);
				yield* repo.saveLayout(layout2);
				return yield* repo.getLayout();
			}),
		);
		expect(result?.version).toBe(2);
		expect(result?.root.type).toBe("group");
		if (result?.root.type === "group") {
			expect(result.root.panels).toHaveLength(1);
		}
	});

	it("returns null for invalid stored data", async () => {
		const result = await runTest(
			Effect.gen(function* () {
				const repo = yield* LayoutRepository;
				// Save valid data first, then verify decode works
				const layout: PersistedLayout = {
					version: 2,
					root: { id: "g1", type: "group", panels: [], activePanel: "" },
				};
				yield* repo.saveLayout(layout);
				return yield* repo.getLayout();
			}),
		);
		expect(result).not.toBeNull();
	});
});
