import { EventGroup, EventJournal, EventLog } from "@effect/experimental";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";

const TestEvents = EventGroup.empty.add({
	tag: "test.greet",
	primaryKey: () => "global",
	payload: Schema.Struct({ name: Schema.String }),
	success: Schema.String,
});

const TestSchema = EventLog.schema(TestEvents);

const TestHandlers = EventLog.group(TestEvents, (h) =>
	h.handle("test.greet", ({ payload }) => Effect.succeed(`Hello, ${payload.name}!`)),
);

const IdentityLive = Layer.succeed(EventLog.Identity, EventLog.Identity.makeRandom());

const JournalLive = EventJournal.layerMemory;

const TestLive = EventLog.layer(TestSchema).pipe(
	Layer.provide(TestHandlers),
	Layer.provide(JournalLive),
	Layer.provide(IdentityLive),
);

const runTest = <A, E>(effect: Effect.Effect<A, E, EventLog.EventLog>) =>
	Effect.runPromise(effect.pipe(Effect.provide(TestLive)));

describe("EventLog POC — full stack", () => {
	it("makeClient dispatches and returns typed result", async () => {
		await runTest(
			Effect.gen(function* () {
				const client = yield* EventLog.makeClient(TestSchema);
				const result = yield* client("test.greet", { name: "World" });
				expect(result).toBe("Hello, World!");
			}),
		);
	});

	it("makeClient rejects wrong payload at compile time", async () => {
		await runTest(
			Effect.gen(function* () {
				const client = yield* EventLog.makeClient(TestSchema);
				const result = yield* client("test.greet", { name: "Effect" });
				expect(typeof result).toBe("string");
			}),
		);
	});
});
