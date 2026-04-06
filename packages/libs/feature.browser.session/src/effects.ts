import { Effects } from "@ctrl/base.op.browsing"
import { EventBus } from "@ctrl/core.contract.event-bus"
import { SqliteDrizzle } from "@effect/sql-drizzle/Sqlite"
import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { pagesTable, sessionsTable } from "./schema"

const now = () => new Date().toISOString()
const genId = () => crypto.randomUUID()

export const sessionEffects = Effect.gen(function* () {
	const db = yield* SqliteDrizzle
	const bus = yield* EventBus

	return {
		[Effects.SESSION_CREATE]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const id = (p.instanceId as string) ?? genId()
				const timestamp = now()
				yield* db.insert(sessionsTable).values({
					id,
					mode: "visual",
					isActive: true,
					currentIndex: 0,
					createdAt: timestamp,
					updatedAt: timestamp,
				})
				// Create an initial page so currentIndex: 0 is valid
				yield* db.insert(pagesTable).values({
					id: genId(),
					sessionId: id,
					url: "about:blank",
					title: null,
					pageIndex: 0,
					loadedAt: timestamp,
				})
				// Choreography: tell workspace to add a panel for this session
				yield* bus.send({
					type: "command",
					action: "ws.add-panel",
					payload: { panelId: id, groupId: "__auto__" },
					meta: { source: "system" },
				})
			}),

		[Effects.SESSION_ACTIVATE]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const id = p.instanceId as string
				// Set this session active, deactivate others
				yield* db.update(sessionsTable).set({ isActive: false })
				yield* db.update(sessionsTable).set({ isActive: true, updatedAt: now() }).where(eq(sessionsTable.id, id))
				// Choreography: tell workspace to activate panel
				yield* bus.send({
					type: "command",
					action: "ws.activate-panel",
					payload: { panelId: id },
					meta: { source: "system" },
				})
			}),

		[Effects.SESSION_CLOSE]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const id = p.instanceId as string
				yield* db.delete(pagesTable).where(eq(pagesTable.sessionId, id))
				yield* db.delete(sessionsTable).where(eq(sessionsTable.id, id))
				// Choreography: tell workspace to remove panel
				yield* bus.send({
					type: "command",
					action: "ws.close-panel",
					payload: { panelId: id },
					meta: { source: "system" },
				})
			}),

		[Effects.SESSION_UPDATE_URL]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const sessionId = p.instanceId as string
				const url = p.url as string
				const timestamp = now()
				// Get current page count to determine next index
				const existingPages = yield* db
					.select()
					.from(pagesTable)
					.where(eq(pagesTable.sessionId, sessionId))
				const nextIndex = existingPages.length
				yield* db.insert(pagesTable).values({
					id: genId(),
					sessionId,
					url,
					title: null,
					pageIndex: nextIndex,
					loadedAt: timestamp,
				})
				yield* db
					.update(sessionsTable)
					.set({ currentIndex: nextIndex, updatedAt: timestamp })
					.where(eq(sessionsTable.id, sessionId))
			}),

		[Effects.SESSION_UPDATE_TITLE]: (p: Record<string, unknown>) =>
			Effect.gen(function* () {
				const sessionId = p.instanceId as string
				const title = p.title as string
				// Update latest page title
				const session = yield* db
					.select()
					.from(sessionsTable)
					.where(eq(sessionsTable.id, sessionId))
				if (session.length > 0) {
					const currentIndex = session[0].currentIndex
					yield* db
						.update(pagesTable)
						.set({ title })
						.where(eq(pagesTable.sessionId, sessionId))
					yield* db
						.update(sessionsTable)
						.set({ updatedAt: now() })
						.where(eq(sessionsTable.id, sessionId))
				}
			}),

		[Effects.SESSION_UPDATE_FAVICON]: (_p: Record<string, unknown>) => Effect.void,

		[Effects.SESSION_SET_ERROR]: (_p: Record<string, unknown>) => Effect.void,
	}
})
