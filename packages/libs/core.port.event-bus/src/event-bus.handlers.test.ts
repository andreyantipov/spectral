import { Headers } from "@effect/platform";
import { Chunk, Duration, Effect, Fiber, Layer, ManagedRuntime, Stream } from "effect";
import { afterAll, describe, expect, it } from "vitest";
import { EventBusLive } from "./event-bus.live";
import { EventBusRpcs } from "./event-bus.rpc";
import { type AppEvent, EventBus } from "./index";

// Build handlers inline to avoid circular dependency with ./index re-exporting
// EventBusHandlersLive from ./event-bus.handlers (which imports EventBus from ./index)
const EventBusHandlersLayer = EventBusRpcs.toLayer(
	Effect.gen(function* () {
		const bus = yield* EventBus;
		return {
			dispatch: ({
				command,
			}: {
				command: {
					type: "command";
					action: string;
					payload?: unknown;
					meta?: { source: "keyboard" | "menu" | "agent" | "ui" | "system" };
				};
			}) => bus.send(command),
			eventStream: () => bus.events,
		};
	}),
);

const TestLayer = Layer.mergeAll(
	EventBusHandlersLayer.pipe(Layer.provide(EventBusLive)),
	EventBusLive,
);
const runtime = ManagedRuntime.make(TestLayer);
afterAll(() => runtime.dispose());

type HandlerFn<P, R> = (payload: P, headers: typeof Headers.empty) => R;

describe("EventBus Handlers", () => {
	it("dispatch command → EventBus receives it", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const bus = yield* EventBus;

				// Subscribe to commands
				const fiber = yield* bus.commands.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));

				// Dispatch via RPC handler
				const dispatch = yield* EventBusRpcs.accessHandler("dispatch");
				yield* (
					dispatch as unknown as HandlerFn<
						{
							command: {
								type: "command";
								action: string;
								payload?: unknown;
							};
						},
						Effect.Effect<void>
					>
				)(
					{
						command: {
							type: "command",
							action: "test.integration",
							payload: { foo: "bar" },
						},
					},
					Headers.empty,
				);

				const collected = yield* Fiber.join(fiber);
				const items = Chunk.toArray(collected);
				expect(items).toHaveLength(1);
				expect(items[0].action).toBe("test.integration");
				expect(items[0].payload).toEqual({ foo: "bar" });
			}),
		);
	});

	it("publish event → eventStream emits it", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const bus = yield* EventBus;

				// Get the stream handler
				const eventStream = yield* EventBusRpcs.accessHandler("eventStream");
				const stream = (eventStream as unknown as HandlerFn<undefined, Stream.Stream<AppEvent>>)(
					undefined,
					Headers.empty,
				);

				// Subscribe to stream
				const fiber = yield* stream.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));

				// Publish event directly on bus
				yield* bus.publish({
					type: "event",
					name: "test.happened",
					timestamp: Date.now(),
					payload: { result: 42 },
				});

				const collected = yield* Fiber.join(fiber);
				const items = Chunk.toArray(collected);
				expect(items).toHaveLength(1);
				expect(items[0].name).toBe("test.happened");
				expect(items[0].payload).toEqual({ result: 42 });
			}),
		);
	});

	it("full round-trip: dispatch command → handler publishes event → stream receives it", async () => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const bus = yield* EventBus;

				// Simulate a service: subscribe to commands, publish events
				const serviceFiber = yield* bus.commands.pipe(
					Stream.filter((cmd) => cmd.action === "roundtrip.test"),
					Stream.take(1),
					Stream.runForEach((cmd) =>
						bus.publish({
							type: "event",
							name: "roundtrip.done",
							timestamp: Date.now(),
							payload: cmd.payload,
							causedBy: cmd.action,
						}),
					),
					Effect.fork,
				);

				// Subscribe to events
				const eventFiber = yield* bus
					.on("roundtrip.done")
					.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

				yield* Effect.sleep(Duration.millis(10));

				// Dispatch command
				yield* bus.send({
					type: "command",
					action: "roundtrip.test",
					payload: { echo: "hello" },
					meta: { source: "ui" },
				});

				const events = Chunk.toArray(yield* Fiber.join(eventFiber));
				expect(events).toHaveLength(1);
				expect(events[0].name).toBe("roundtrip.done");
				expect(events[0].payload).toEqual({ echo: "hello" });
				expect(events[0].causedBy).toBe("roundtrip.test");

				yield* Fiber.interrupt(serviceFiber);
			}),
		);
	});
});
