import {
	AppEvents,
	BookmarkEvents,
	NavigationEvents,
	SessionEvents,
} from "@ctrl/core.contract.event-bus";
import { EventGroup, EventLog } from "@effect/experimental";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("EventGroup/EventLog API at 0.58.0", () => {
	const TestEvents = EventGroup.empty.add({
		tag: "test.greet",
		primaryKey: () => "global",
		payload: Schema.Struct({ name: Schema.String }),
		success: Schema.String,
	});

	it("EventGroup.empty creates a group", () => {
		expect(TestEvents).toBeDefined();
		expect(TestEvents.events).toBeDefined();
	});

	it("EventLog.schema creates a schema from groups", () => {
		const schema = EventLog.schema(TestEvents);
		expect(schema).toBeDefined();
	});

	it("EventLog.group creates exhaustive handlers", () => {
		const handlers = EventLog.group(TestEvents, (h) =>
			h.handle("test.greet", ({ payload }) => Effect.succeed(`Hello, ${payload.name}!`)),
		);
		expect(handlers).toBeDefined();
	});
});

describe("App EventGroups", () => {
	it("SessionEvents has 3 events", () => {
		expect(Object.keys(SessionEvents.events)).toHaveLength(3);
		expect(SessionEvents.events["session.create"]).toBeDefined();
		expect(SessionEvents.events["session.close"]).toBeDefined();
		expect(SessionEvents.events["session.activate"]).toBeDefined();
	});

	it("NavigationEvents has 5 events", () => {
		expect(Object.keys(NavigationEvents.events)).toHaveLength(5);
		expect(NavigationEvents.events["nav.navigate"]).toBeDefined();
		expect(NavigationEvents.events["nav.back"]).toBeDefined();
	});

	it("BookmarkEvents has 2 events", () => {
		expect(Object.keys(BookmarkEvents.events)).toHaveLength(2);
	});

	it("AppEvents schema combines all groups", () => {
		expect(AppEvents).toBeDefined();
	});
});
