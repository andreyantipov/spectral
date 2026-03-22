import { DatabaseError } from "@ctrl/core.base.errors";
import type { Page, Session } from "@ctrl/core.base.model";
import { withTracing } from "@ctrl/core.base.tracing";
import { DEFAULT_TAB_URL } from "@ctrl/core.base.types";
import { SessionRepository } from "@ctrl/core.port.storage";
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { pagesTable } from "../model/pages.schema";
import { sessionsTable } from "../model/sessions.schema";

export const SessionRepositoryLive = Layer.effect(
	SessionRepository,
	Effect.gen(function* () {
		const db = yield* SqliteDrizzle;

		const now = () => new Date().toISOString();
		const genId = () => crypto.randomUUID();

		const assembleSession = (
			row: typeof sessionsTable.$inferSelect,
			pageRows: (typeof pagesTable.$inferSelect)[],
		): Session => ({
			id: row.id,
			mode: row.mode as "visual",
			isActive: row.isActive,
			currentIndex: row.currentIndex,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			pages: pageRows
				.filter((p) => p.sessionId === row.id)
				.map((p): Page => ({ url: p.url, title: p.title, loadedAt: p.loadedAt })),
		});

		return withTracing("SessionRepository", {
			getAll: () =>
				Effect.gen(function* () {
					const sessions = yield* db
						.select()
						.from(sessionsTable)
						.orderBy(asc(sessionsTable.createdAt));
					// NOTE: Loads all pages in memory. For large histories, consider per-session page loading.
					const pages = yield* db.select().from(pagesTable).orderBy(asc(pagesTable.pageIndex));
					return sessions.map((s) => assembleSession(s, pages));
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to get all sessions", cause })),
					),
				),

			getById: (id: string) =>
				Effect.gen(function* () {
					const sessions = yield* db.select().from(sessionsTable).where(eq(sessionsTable.id, id));
					if (sessions.length === 0) return undefined;
					const pages = yield* db.select().from(pagesTable).where(eq(pagesTable.sessionId, id));
					pages.sort((a, b) => a.pageIndex - b.pageIndex);
					return assembleSession(sessions[0], pages);
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to get session by id", cause })),
					),
				),

			create: (mode: "visual") =>
				Effect.gen(function* () {
					const id = genId();
					const timestamp = now();
					const values = {
						id,
						mode,
						isActive: false,
						currentIndex: 0,
						createdAt: timestamp,
						updatedAt: timestamp,
					};
					yield* db.insert(sessionsTable).values(values);
					// Always create an initial page so currentIndex: 0 is valid
					const initialPage = {
						id: genId(),
						sessionId: id,
						url: DEFAULT_TAB_URL,
						title: null,
						pageIndex: 0,
						loadedAt: timestamp,
					};
					yield* db.insert(pagesTable).values(initialPage);
					return {
						...values,
						pages: [{ url: DEFAULT_TAB_URL, title: null, loadedAt: timestamp } as Page],
					} as Session;
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to create session", cause })),
					),
				),

			remove: (id: string) =>
				db
					.delete(sessionsTable)
					.where(eq(sessionsTable.id, id))
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to remove session", cause })),
						),
					),

			setActive: (id: string) =>
				db
					.update(sessionsTable)
					.set({
						isActive: sql`CASE WHEN ${sessionsTable.id} = ${id} THEN 1 ELSE 0 END`,
						updatedAt: now(),
					})
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to set active session", cause })),
						),
					),

			updateCurrentIndex: (id: string, index: number) =>
				db
					.update(sessionsTable)
					.set({ currentIndex: index, updatedAt: now() })
					.where(eq(sessionsTable.id, id))
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to update current index", cause })),
						),
					),

			addPage: (sessionId: string, url: string, atIndex: number) =>
				Effect.gen(function* () {
					const id = genId();
					const loadedAt = now();
					const values = {
						id,
						sessionId,
						url,
						title: null,
						pageIndex: atIndex,
						loadedAt,
					};
					yield* db.insert(pagesTable).values(values);
					return { url, title: null, loadedAt } as Page;
				}).pipe(
					Effect.catchAll((cause) =>
						Effect.fail(new DatabaseError({ message: "Failed to add page", cause })),
					),
				),

			removePagesAfterIndex: (sessionId: string, index: number) =>
				db
					.delete(pagesTable)
					.where(and(eq(pagesTable.sessionId, sessionId), gt(pagesTable.pageIndex, index)))
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(
								new DatabaseError({ message: "Failed to remove pages after index", cause }),
							),
						),
					),

			updatePageTitle: (sessionId: string, pageIndex: number, title: string) =>
				db
					.update(pagesTable)
					.set({ title })
					.where(and(eq(pagesTable.sessionId, sessionId), eq(pagesTable.pageIndex, pageIndex)))
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to update page title", cause })),
						),
					),

			updatePageUrl: (sessionId: string, pageIndex: number, url: string) =>
				db
					.update(pagesTable)
					.set({ url })
					.where(and(eq(pagesTable.sessionId, sessionId), eq(pagesTable.pageIndex, pageIndex)))
					.pipe(
						Effect.asVoid,
						Effect.catchAll((cause) =>
							Effect.fail(new DatabaseError({ message: "Failed to update page url", cause })),
						),
					),
		});
	}),
);
