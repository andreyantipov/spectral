import { describe, expect, it } from "bun:test";
import { WebSessionSpec } from "./web-session";

describe("WebSessionSpec", () => {
	it("is JSON serializable", () => {
		const json = JSON.parse(JSON.stringify(WebSessionSpec));
		expect(json.id).toBe("web-session");
		expect(json.states.Browsing.on.Navigate.target).toBe("Loading");
	});

	it("has correct lifecycle", () => {
		expect(WebSessionSpec.initial).toBe("Idle");
		expect(WebSessionSpec.triggers).toContain("CreateSession");
		expect(WebSessionSpec.terminalOn).toContain("CloseSession");
	});

	it("Navigate from Browsing has guard and effects", () => {
		const t = WebSessionSpec.states.Browsing.on?.Navigate;
		expect(t?.guards).toContain("UrlIsValid");
		expect(t?.effects).toContain("StartNavigation");
	});

	it("UrlCommitted from Loading triggers multiple effects", () => {
		const t = WebSessionSpec.states.Loading.on?.UrlCommitted;
		expect(t?.effects).toContain("WriteTitle");
		expect(t?.effects).toContain("WriteFavicon");
		expect(t?.effects).toContain("RecordHistory");
	});

	it("Browsing allows Navigate, TitleChanged, CloseSession", () => {
		const s = WebSessionSpec.states.Browsing;
		expect(s.on?.Navigate).toBeDefined();
		expect(s.on?.TitleChanged).toBeDefined();
		expect(s.on?.CloseSession).toBeDefined();
	});

	it("Error allows Navigate and CloseSession", () => {
		const s = WebSessionSpec.states.Error;
		expect(s.on?.Navigate?.target).toBe("Loading");
		expect(s.on?.CloseSession?.target).toBe("Closed");
	});

	it("Closed is terminal (no transitions)", () => {
		expect(WebSessionSpec.states.Closed.on).toBeUndefined();
	});
});
