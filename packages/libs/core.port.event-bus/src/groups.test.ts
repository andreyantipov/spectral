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
