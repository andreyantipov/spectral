import { DatabaseError } from "@ctrl/base.error";
import { PersistedLayoutSchema } from "@ctrl/base.schema";
import { withTracing } from "@ctrl/base.tracing";
import { LayoutRepository } from "@ctrl/arch.contract.storage";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { eq } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import { workspaceLayoutTable } from "./workspace-layout.schema";

const decodePersistedLayout = Schema.decodeUnknown(PersistedLayoutSchema);

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
					const raw = JSON.parse(row.dockviewState);
					// DB column stores {version, root} as JSON in the legacy "dockviewState" column
					const decoded = yield* decodePersistedLayout(raw).pipe(
						Effect.catchAll(() => Effect.succeed(null)),
					);
					return decoded;
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
						dockviewState: JSON.stringify(layout),
						updatedAt: new Date().toISOString(),
					})
					.onConflictDoUpdate({
						target: workspaceLayoutTable.id,
						set: {
							version: layout.version,
							dockviewState: JSON.stringify(layout),
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
