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
	const runtime = useRuntime() as unknown as ManagedRuntime.ManagedRuntime<EventBus, never>;
	const bus = runtime.runSync(EventBus);

	function dispatch<T extends AllTags>(tag: T, payload: PayloadFor<T>): void {
		const cmd: AppCommand = { type: "command", action: tag, payload, meta: { source: "ui" } };
		void runtime.runPromise(bus.send(cmd));
	}

	function send(action: string, payload?: unknown): void {
		const cmd: AppCommand = { type: "command", action, payload, meta: { source: "ui" } };
		void runtime.runPromise(bus.send(cmd));
	}

	/** Dispatch a TaggedClass action — extracts _tag as action name, rest as payload */
	function dispatchAction(action: { readonly _tag: string }): void {
		const { _tag, ...payload } = action as { readonly _tag: string; readonly [key: string]: unknown };
		const cmd: AppCommand = { type: "command", action: _tag, payload, meta: { source: "ui" } };
		void runtime.runPromise(bus.send(cmd));
	}

	const owner = getOwner();
	const subscriptions = new Map<string, Accessor<unknown>>();
	const stateSignals = new Map<string, [Accessor<unknown>, (v: unknown) => void]>();
	const eventPubSub = runtime.runSync(PubSub.unbounded<AppEvent>());

	const handleEvent = (evt: AppEvent) => {
		// Fan out to per-event PubSub (for api.on())
		void runtime.runPromise(PubSub.publish(eventPubSub, evt));

		// Direct state-sync handling (for api.state())
		if (evt.name === "state-sync" && evt.payload) {
			const data = evt.payload as Record<string, unknown>;
			for (const [path, value] of Object.entries(data)) {
				const entry = stateSignals.get(path);
				if (entry) entry[1](value);
			}
		}
	};

	// Single onMount: subscribe to bus events and fan out to per-event signals + state signals
	onMount(() => {
		if (!owner) return;

		const fiber = runtime.runFork(
			bus.events.pipe(
				Stream.catchAll(() => Stream.empty),
				Stream.runForEach((evt) => Effect.sync(() => runWithOwner(owner, () => handleEvent(evt)))),
			),
		);
		onCleanup(() => runtime.runFork(Fiber.interrupt(fiber)));

		// Request initial state — sends noop command to trigger state-sync publish
		requestAnimationFrame(() => {
			send("ui.ready", {});
		});
	});

	function state<T>(path: string): Accessor<T> {
		const existing = stateSignals.get(path);
		if (existing) return existing[0] as Accessor<T>;

		const [value, setValue] = createSignal<T>(undefined as T);
		stateSignals.set(path, [value as Accessor<unknown>, setValue as (v: unknown) => void]);
		return value as Accessor<T>;
	}

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

	return { dispatch, dispatchAction, send, on, state };
}
