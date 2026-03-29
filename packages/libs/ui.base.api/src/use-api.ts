import {
	type AppCommand,
	type AppEvent,
	type AppEvents,
	EventBus,
} from "@ctrl/core.contract.event-bus";
import type { Event } from "@effect/experimental/Event";
import type { EventGroup } from "@effect/experimental/EventGroup";
import { Effect, Fiber, type ManagedRuntime, PubSub, Stream } from "effect";
import { type Accessor, createSignal, getOwner, onCleanup, onMount, runWithOwner } from "solid-js";
import { useRuntime } from "./use-runtime";

/** All event tags from AppEvents — union of all possible tags */
type AllTags = Event.Tag<EventGroup.Events<(typeof AppEvents)["groups"][number]>>;

/** Payload for a specific tag */
type PayloadFor<T extends AllTags> = Event.PayloadWithTag<
	EventGroup.Events<(typeof AppEvents)["groups"][number]>,
	T
>;

export function useApi() {
	// Runtime boundary cast — SolidJS Context is untyped, actual runtime has EventBus
	const runtime = useRuntime() as unknown as ManagedRuntime.ManagedRuntime<EventBus, never>;

	const bus = runtime.runSync(EventBus);

	/** Send a typed command through EventBus carrier */
	function dispatch<T extends AllTags>(tag: T, payload: PayloadFor<T>): void {
		const cmd: AppCommand = {
			type: "command",
			action: tag,
			payload,
			meta: { source: "ui" },
		};
		void runtime.runPromise(bus.send(cmd));
	}

	/** Send an untyped command (for dynamic dispatch from shortcuts) */
	function send(action: string, payload?: unknown): void {
		const cmd: AppCommand = {
			type: "command",
			action,
			payload,
			meta: { source: "ui" },
		};
		void runtime.runPromise(bus.send(cmd));
	}

	// Event subscription — single shared stream, fan out to per-event signals
	const owner = getOwner();
	const subscriptions = new Map<string, Accessor<unknown>>();
	const eventPubSub = runtime.runSync(PubSub.unbounded<AppEvent>());

	onMount(() => {
		if (!owner) return;
		const stream = bus.events.pipe(
			Stream.catchAll((error) => {
				console.error("[useApi] eventStream error:", error);
				return Stream.empty;
			}),
		);
		const fiber = runtime.runFork(
			stream.pipe(Stream.runForEach((evt) => PubSub.publish(eventPubSub, evt))),
		);
		onCleanup(() => runtime.runFork(Fiber.interrupt(fiber)));

		// Request initial state
		requestAnimationFrame(() => {
			dispatch("state.request", {});
		});
	});

	function on<T = unknown>(eventName: string): Accessor<T | undefined> {
		const existing = subscriptions.get(eventName);
		if (existing) return existing as Accessor<T | undefined>;

		const [value, setValue] = createSignal<T | undefined>(undefined);

		onMount(() => {
			if (!owner) return;
			const localStream = Stream.fromPubSub(eventPubSub).pipe(
				Stream.filter((evt: AppEvent) => evt.name === eventName),
			);
			const fiber = runtime.runFork(
				localStream.pipe(
					Stream.runForEach((evt) =>
						Effect.sync(() => runWithOwner(owner, () => setValue(() => evt.payload as T))),
					),
				),
			);
			onCleanup(() => runtime.runFork(Fiber.interrupt(fiber)));
		});

		subscriptions.set(eventName, value);
		return value as Accessor<T | undefined>;
	}

	return { dispatch, send, on };
}
