import { Effect, Fiber, Stream } from "effect";
import { type Accessor, createSignal, getOwner, onCleanup, onMount, runWithOwner } from "solid-js";
import { useRuntime } from "./runtime-provider";

export function useStream<A>(stream: Stream.Stream<A, unknown, never>, initial: A): Accessor<A> {
	const [value, setValue] = createSignal(initial);
	const runtime = useRuntime();
	const owner = getOwner();

	onMount(() => {
		const fiber = runtime.runFork(
			stream.pipe(
				Stream.runForEach((a) => Effect.sync(() => runWithOwner(owner, () => setValue(() => a)))),
			),
		);
		onCleanup(() => runtime.runFork(Fiber.interrupt(fiber)));
	});

	return value;
}
