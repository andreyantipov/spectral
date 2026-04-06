import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { pagesTable, sessionsTable } from "@ctrl/base.model.session";

const now = () => new Date().toISOString();
const genId = () => crypto.randomUUID();

// Effect keys matching WebSession spec (PascalCase)
const InsertSession = "InsertSession";
const RemoveSession = "RemoveSession";
const ActivateSession = "ActivateSession";
const WriteUrl = "WriteUrl";
const WriteTitle = "WriteTitle";
const WriteFavicon = "WriteFavicon";
const SetError = "SetError";

export const sessionEffects = Effect.gen(function* () {
	const db = yield* SqliteDrizzle;

	return {
		[InsertSession]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const id = (p.instanceId as string) ?? genId();
				const timestamp = now();
				yield* db.insert(sessionsTable).values({
					id,
					mode: "visual",
					isActive: true,
					currentIndex: 0,
					createdAt: timestamp,
					updatedAt: timestamp,
				});
				// Create an initial page so currentIndex: 0 is valid
				yield* db.insert(pagesTable).values({
					id: genId(),
					sessionId: id,
					url: "about:blank",
					title: null,
					pageIndex: 0,
					loadedAt: timestamp,
				});
				// Return EffectResult — SpecRunner dispatches emit
				return {
					data: { id },
					emit: {
						"ws.add-panel": {
							groupId: "__auto__",
							panel: { id, type: "session" as const, entityId: id, title: "New Tab", icon: null },
						},
					},
				};
			}),

		[ActivateSession]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const id = p.instanceId as string;
				// Set this session active, deactivate others
				yield* db.update(sessionsTable).set({ isActive: false });
				yield* db
					.update(sessionsTable)
					.set({ isActive: true, updatedAt: now() })
					.where(eq(sessionsTable.id, id));
				return {
					emit: {
						"ws.activate-panel": { panelId: id },
					},
				};
			}),

		[RemoveSession]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const id = p.instanceId as string;
				yield* db.delete(pagesTable).where(eq(pagesTable.sessionId, id));
				yield* db.delete(sessionsTable).where(eq(sessionsTable.id, id));
				const remaining = yield* db.select().from(sessionsTable);
				return {
					data: { id, wasLast: remaining.length === 0 },
					emit: {
						"ws.close-panel": { panelId: id },
					},
				};
			}),

		[WriteUrl]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const sessionId = p.instanceId as string;
				const url = p.url as string;
				const timestamp = now();
				// Get current page count to determine next index
				const existingPages = yield* db
					.select()
					.from(pagesTable)
					.where(eq(pagesTable.sessionId, sessionId));
				const nextIndex = existingPages.length;
				yield* db.insert(pagesTable).values({
					id: genId(),
					sessionId,
					url,
					title: null,
					pageIndex: nextIndex,
					loadedAt: timestamp,
				});
				yield* db
					.update(sessionsTable)
					.set({ currentIndex: nextIndex, updatedAt: timestamp })
					.where(eq(sessionsTable.id, sessionId));
			}),

		[WriteTitle]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const sessionId = p.instanceId as string;
				const title = p.title as string;
				// Update latest page title
				const session = yield* db
					.select()
					.from(sessionsTable)
					.where(eq(sessionsTable.id, sessionId));
				if (session.length > 0) {
					yield* db.update(pagesTable).set({ title }).where(eq(pagesTable.sessionId, sessionId));
					yield* db
						.update(sessionsTable)
						.set({ updatedAt: now() })
						.where(eq(sessionsTable.id, sessionId));
				}
				return {
					emit: {
						"ws.update-tab-meta": { panelId: sessionId, title },
					},
				};
			}),

		[WriteFavicon]: (_p: Record<string, unknown>) => Effect.void,
		[SetError]: (_p: Record<string, unknown>) => Effect.void,
	};
});
