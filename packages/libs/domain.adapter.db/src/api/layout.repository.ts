import { DatabaseError } from "@ctrl/core.base.errors";
import { withTracing } from "@ctrl/core.base.tracing";
import { LayoutRepository } from "@ctrl/core.port.storage";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { workspaceLayoutTable } from "../model/workspace-layout.schema";

export const LayoutRepositoryLive = Layer.effect(
	LayoutRepository,
	Effect.gen(function* () {
		const db = yield* SqliteDrizzle;

		return withTracing("LayoutRepository", {
			getLayout: () =>
				Effect.gen(function* () {
					const rows = yield* db
						.select()
						.from(workspaceLayoutTable)
						.where(eq(workspaceLayoutTable.id, "default"));
					if (rows.length === 0) return null;
					const row = rows[0];
					return {
						version: row.version,
						dockviewState: JSON.parse(row.dockviewState),
					};
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to get layout", cause })),
					),
				),

			saveLayout: (layout) =>
				db
					.insert(workspaceLayoutTable)
					.values({
						id: "default",
						version: layout.version,
						dockviewState: JSON.stringify(layout.dockviewState),
						updatedAt: new Date().toISOString(),
					})
					.onConflictDoUpdate({
						target: workspaceLayoutTable.id,
						set: {
							version: layout.version,
							dockviewState: JSON.stringify(layout.dockviewState),
							updatedAt: new Date().toISOString(),
						},
					})
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to save layout", cause })),
						),
					),
		});
	}),
);
