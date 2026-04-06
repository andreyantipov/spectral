import { describe, it, expect } from "bun:test"
import { CreateSession, Navigate, UrlCommitted, CloseSession, TitleChanged, NavigationFailed, ActivateSession, Effects } from "./index"

describe("browsing actions", () => {
	it("CreateSession.make() works", () => {
		const a = CreateSession.make({ mode: "visual" })
		expect(a._tag).toBe("CreateSession")
		expect(a.mode).toBe("visual")
	})

	it("Navigate has instanceId and url", () => {
		const a = Navigate.make({ instanceId: "t1", url: "https://google.com" })
		expect(a._tag).toBe("Navigate")
		expect(a.instanceId).toBe("t1")
	})

	it("UrlCommitted has all fields", () => {
		const a = UrlCommitted.make({ instanceId: "t1", url: "u", title: "t", favicon: "f" })
		expect(a._tag).toBe("UrlCommitted")
		expect(a.title).toBe("t")
	})

	it("all actions are JSON serializable", () => {
		const actions = [
			CreateSession.make({ mode: "visual" }),
			Navigate.make({ instanceId: "t1", url: "u" }),
			CloseSession.make({ instanceId: "t1" }),
			ActivateSession.make({ instanceId: "t1" }),
			UrlCommitted.make({ instanceId: "t1", url: "u", title: "t", favicon: "f" }),
			TitleChanged.make({ instanceId: "t1", title: "t" }),
			NavigationFailed.make({ instanceId: "t1", error: "e" }),
		]
		for (const a of actions) {
			const json = JSON.parse(JSON.stringify(a))
			expect(json._tag).toBe(a._tag)
		}
	})

	it("Effects constants are strings", () => {
		expect(typeof Effects.NAV_START).toBe("string")
		expect(typeof Effects.SESSION_CREATE).toBe("string")
		expect(typeof Effects.HISTORY_RECORD).toBe("string")
		expect(typeof Effects.URL_IS_VALID).toBe("string")
	})
})
