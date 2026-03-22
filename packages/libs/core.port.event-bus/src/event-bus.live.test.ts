import { Chunk, Duration, Effect, Fiber, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { EventBusLive } from "./event-bus.live";
import { EventBus } from "./index";

const runTest = <A, E>(effect: Effect.Effect<A, E, EventBus>) =>
	Effect.runPromise(effect.pipe(Effect.provide(EventBusLive)));

describe("EventBusLive", () => {
	it("send command → commands stream receives it", async () => {
		await runTest(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				const fiber = yield* bus.commands.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
				yield* Effect.sleep(Duration.millis(10));
				yield* bus.send({ type: "command", action: "test.action" });
				const collected = yield* Fiber.join(fiber);
				const items = Chunk.toArray(collected);
				expect(items).toHaveLength(1);
				expect(items[0].action).toBe("test.action");
			}),
		);
	});

	it("publish event → events stream receives it", async () => {
		await runTest(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				const fiber = yield* bus.events.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
				yield* Effect.sleep(Duration.millis(10));
				yield* bus.publish({
					type: "event",
					name: "test.happened",
					timestamp: Date.now(),
				});
				const collected = yield* Fiber.join(fiber);
				const items = Chunk.toArray(collected);
				expect(items).toHaveLength(1);
				expect(items[0].name).toBe("test.happened");
			}),
		);
	});

	it("on(name) filters events by exact name", async () => {
		await runTest(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				const fiber = yield* bus
					.on("session.created")
					.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
				yield* Effect.sleep(Duration.millis(10));
				yield* bus.publish({
					type: "event",
					name: "other.event",
					timestamp: Date.now(),
				});
				yield* bus.publish({
					type: "event",
					name: "session.created",
					timestamp: Date.now(),
					payload: { id: "s1" },
				});
				const collected = yield* Fiber.join(fiber);
				const items = Chunk.toArray(collected);
				expect(items).toHaveLength(1);
				expect(items[0].name).toBe("session.created");
			}),
		);
	});

	it("on(prefix.*) filters events by prefix", async () => {
		await runTest(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				const fiber = yield* bus
					.on("session.*")
					.pipe(Stream.take(2), Stream.runCollect, Effect.fork);
				yield* Effect.sleep(Duration.millis(10));
				yield* bus.publish({
					type: "event",
					name: "nav.navigated",
					timestamp: Date.now(),
				});
				yield* bus.publish({
					type: "event",
					name: "session.created",
					timestamp: Date.now(),
				});
				yield* bus.publish({
					type: "event",
					name: "session.closed",
					timestamp: Date.now(),
				});
				const collected = yield* Fiber.join(fiber);
				const items = Chunk.toArray(collected);
				expect(items).toHaveLength(2);
				expect(items[0].name).toBe("session.created");
				expect(items[1].name).toBe("session.closed");
			}),
		);
	});

	it("command carries payload and meta", async () => {
		await runTest(
			Effect.gen(function* () {
				const bus = yield* EventBus;
				const fiber = yield* bus.commands.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
				yield* Effect.sleep(Duration.millis(10));
				yield* bus.send({
					type: "command",
					action: "session.create",
					payload: { mode: "visual" },
					meta: { source: "keyboard" },
				});
				const collected = yield* Fiber.join(fiber);
				const items = Chunk.toArray(collected);
				expect(items[0].payload).toEqual({ mode: "visual" });
				expect(items[0].meta?.source).toBe("keyboard");
			}),
		);
	});
});
