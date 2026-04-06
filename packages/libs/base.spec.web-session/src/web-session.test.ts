import { describe, it, expect } from "bun:test";
import { WebSessionSpec } from "./web-session";
import { Effects } from "@ctrl/base.op.browsing";

describe("WebSessionSpec", () => {
	it("is JSON serializable", () => {
		const json = JSON.parse(JSON.stringify(WebSessionSpec));
		expect(json.id).toBe("web-session");
		expect(json.states.idle.on.Navigate.target).toBe("loading");
	});

	it("has correct lifecycle", () => {
		expect(WebSessionSpec.initial).toBe("idle");
		expect(WebSessionSpec.triggers).toContain("CreateSession");
		expect(WebSessionSpec.terminalOn).toContain("CloseSession");
	});

	it("Navigate from idle has guard and effect", () => {
		const t = WebSessionSpec.states.idle.on?.Navigate;
		expect(t?.guards).toContain(Effects.URL_IS_VALID);
		expect(t?.effects).toContain(Effects.NAV_START);
	});

	it("UrlCommitted from loading triggers multiple effects", () => {
		const t = WebSessionSpec.states.loading.on?.UrlCommitted;
		expect(t?.effects).toContain(Effects.SESSION_UPDATE_TITLE);
		expect(t?.effects).toContain(Effects.SESSION_UPDATE_FAVICON);
		expect(t?.effects).toContain(Effects.HISTORY_RECORD);
	});

	it("browsing allows Navigate, TitleChanged, CloseSession", () => {
		const s = WebSessionSpec.states.browsing;
		expect(s.on?.Navigate).toBeDefined();
		expect(s.on?.TitleChanged).toBeDefined();
		expect(s.on?.CloseSession).toBeDefined();
	});

	it("error allows Navigate and CloseSession", () => {
		const s = WebSessionSpec.states.error;
		expect(s.on?.Navigate?.target).toBe("loading");
		expect(s.on?.CloseSession?.target).toBe("closed");
	});

	it("closed is terminal (no transitions)", () => {
		expect(WebSessionSpec.states.closed.on).toBeUndefined();
	});
});
