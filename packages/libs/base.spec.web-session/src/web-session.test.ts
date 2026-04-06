import { describe, expect, it } from "bun:test";
import { WebSession } from "./web-session";

describe("WebSession", () => {
	it("is JSON serializable", () => {
		const json = JSON.parse(JSON.stringify(WebSession));
		expect(json.id).toBe("web-session");
		expect(json.states.Browsing.on.Navigate.target).toBe("Loading");
	});

	it("has correct lifecycle", () => {
		expect(WebSession.initial).toBe("Idle");
		expect(WebSession.triggers).toContain("CreateSession");
		expect(WebSession.terminalOn).toContain("CloseSession");
	});

	it("Navigate from Browsing has guard and effects", () => {
		const t = WebSession.states.Browsing.on?.Navigate;
		expect(t?.guards).toContain("UrlIsValid");
		expect(t?.effects).toContain("StartNavigation");
	});

	it("UrlCommitted from Loading triggers multiple effects", () => {
		const t = WebSession.states.Loading.on?.UrlCommitted;
		expect(t?.effects).toContain("WriteTitle");
		expect(t?.effects).toContain("WriteFavicon");
		expect(t?.effects).toContain("RecordHistory");
	});

	it("Browsing allows Navigate, TitleChanged, CloseSession", () => {
		const s = WebSession.states.Browsing;
		expect(s.on?.Navigate).toBeDefined();
		expect(s.on?.TitleChanged).toBeDefined();
		expect(s.on?.CloseSession).toBeDefined();
	});

	it("Error allows Navigate and CloseSession", () => {
		const s = WebSession.states.Error;
		expect(s.on?.Navigate?.target).toBe("Loading");
		expect(s.on?.CloseSession?.target).toBe("Closed");
	});

	it("Closed is terminal (no transitions)", () => {
		expect(WebSession.states.Closed.on).toBeUndefined();
	});
});
