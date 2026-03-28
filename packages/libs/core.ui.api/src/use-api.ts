import {
	type AppCommand,
	type AppEvent,
	BM_ADD,
	BM_REMOVE,
	EventBusRpcs,
	NAV_BACK,
	NAV_FORWARD,
	NAV_NAVIGATE,
	NAV_REPORT,
	NAV_UPDATE_TITLE,
	SESSION_ACTIVATE,
	SESSION_CLOSE,
	SESSION_CREATE,
} from "@ctrl/core.port.event-bus";
import { RpcClient } from "@effect/rpc";
import type { Protocol } from "@effect/rpc/RpcClient";
import { Effect, Exit, Fiber, type ManagedRuntime, PubSub, Scope, Stream } from "effect";
import { type Accessor, createSignal, getOwner, onCleanup, onMount, runWithOwner } from "solid-js";
import { useRuntime } from "./use-runtime";

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

	// Command dispatch
	const send = (action: string, payload?: unknown) => {
		const cmd: AppCommand = {
			type: "command",
			action,
			payload,
			meta: { source: "ui" },
		};
		void runtime.runPromise(client.dispatch({ command: cmd }));
	};

	// Single shared event stream — fan out to per-event signals
	const owner = getOwner();
	const subscriptions = new Map<string, Accessor<unknown>>();
	const eventPubSub = runtime.runSync(PubSub.unbounded<AppEvent>());

	// Start single eventStream listener, broadcast to local PubSub
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

	return {
		send,
		on,
		session: {
			create: (payload: { readonly mode: "visual" }) => send(SESSION_CREATE, payload),
			close: (payload: { readonly id: string }) => send(SESSION_CLOSE, payload),
			activate: (payload: { readonly id: string }) => send(SESSION_ACTIVATE, payload),
		},
		nav: {
			navigate: (payload: { readonly id: string; readonly input: string }) =>
				send(NAV_NAVIGATE, payload),
			back: (payload: { readonly id: string }) => send(NAV_BACK, payload),
			forward: (payload: { readonly id: string }) => send(NAV_FORWARD, payload),
			report: (payload: { readonly id: string; readonly url: string }) => send(NAV_REPORT, payload),
			updateTitle: (payload: { readonly id: string; readonly title: string }) =>
				send(NAV_UPDATE_TITLE, payload),
		},
		bm: {
			add: (payload: { readonly url: string; readonly title: string | null }) =>
				send(BM_ADD, payload),
			remove: (payload: { readonly id: string }) => send(BM_REMOVE, payload),
		},
	};
}
