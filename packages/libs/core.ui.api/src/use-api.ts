import {
	type AppCommand,
	type AppEvent,
	type AppEvents,
	EventBusRpcs,
	SystemEvents,
} from "@ctrl/core.port.event-bus";
import type { Event } from "@effect/experimental/Event";
import type { EventGroup } from "@effect/experimental/EventGroup";
import { RpcClient } from "@effect/rpc";
import type { Protocol } from "@effect/rpc/RpcClient";
import { Effect, Exit, Fiber, type ManagedRuntime, PubSub, Scope, Stream } from "effect";
import { type Accessor, createSignal, getOwner, onCleanup, onMount, runWithOwner } from "solid-js";
import { useRuntime } from "./use-runtime";

/**
 * Typed dispatch function — types derived from EventGroup at compile time.
 * No EventLog needed. Just wraps send() with tag + payload type checking.
 */
type TypedDispatch<Groups extends EventGroup.Any> = <
	Tag extends Event.Tag<EventGroup.Events<Groups>>,
>(
	tag: Tag,
	payload: Event.PayloadWithTag<EventGroup.Events<Groups>, Tag>,
) => void;

export function useApi() {
	const runtime = useRuntime() as unknown as ManagedRuntime.ManagedRuntime<
		Protocol | Scope.Scope,
		never
	>;

	const scope = runtime.runSync(Scope.make());
	onCleanup(() => runtime.runSync(Scope.close(scope, Exit.void)));

	const client = runtime.runSync(
		RpcClient.make(EventBusRpcs).pipe(Effect.provideService(Scope.Scope, scope)),
	) as RpcClient.FromGroup<typeof EventBusRpcs>;

	// Typed dispatch — sends command through carrier, types from EventGroup
	const dispatch: TypedDispatch<(typeof AppEvents)["groups"][number]> = (tag, payload) => {
		const cmd: AppCommand = {
			type: "command",
			action: tag,
			payload: payload as unknown,
			meta: { source: "ui" },
		};
		void runtime.runPromise(client.dispatch({ command: cmd }));
	};

	// Event subscription — single shared stream, fan out to per-event signals
	const owner = getOwner();
	const subscriptions = new Map<string, Accessor<unknown>>();
	const eventPubSub = runtime.runSync(PubSub.unbounded<AppEvent>());

	onMount(() => {
		if (!owner) return;
		const stream = client.eventStream().pipe(
			Stream.catchAll((error) => {
				console.error("[useApi] eventStream error:", error);
				return Stream.empty;
			}),
		);
		const fiber = runtime.runFork(
			stream.pipe(Stream.runForEach((evt) => PubSub.publish(eventPubSub, evt))),
		);
		onCleanup(() => runtime.runFork(Fiber.interrupt(fiber)));

		// Request initial state — delay to ensure eventStream listener is active
		requestAnimationFrame(() => {
			dispatch(
				SystemEvents.events["state.request"].tag as Parameters<typeof dispatch>[0],
				{} as never,
			);
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

	return { dispatch, on };
}
