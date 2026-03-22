import { describe, expect, it } from "vitest";
import { BookmarkSignals, DiagnosticSignals, NavigationSignals, SessionSignals } from "./all";

describe("Signal definitions", () => {
	it("SessionSignals.commands.create has correct name", () => {
		expect(SessionSignals.commands.create.name).toBe("session.create");
		expect(SessionSignals.commands.create._tag).toBe("command");
	});

	it("SessionSignals.events.created has correct name", () => {
		expect(SessionSignals.events.created.name).toBe("session.created");
		expect(SessionSignals.events.created._tag).toBe("event");
	});

	it("NavigationSignals.commands.navigate has correct name", () => {
		expect(NavigationSignals.commands.navigate.name).toBe("nav.navigate");
	});

	it("BookmarkSignals has commands and events", () => {
		expect(BookmarkSignals.commands.add.name).toBe("bm.add");
		expect(BookmarkSignals.events.added.name).toBe("bm.added");
	});

	it("DiagnosticSignals.commands.ping", () => {
		expect(DiagnosticSignals.commands.ping.name).toBe("diag.ping");
		expect(DiagnosticSignals.events.pong.name).toBe("diag.pong");
	});
});
