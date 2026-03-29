import { RuntimeContext, useRuntime } from "./use-runtime";
import type { ManagedRuntime } from "effect";
import type { ParentProps } from "solid-js";

type UntypedManagedRuntime = ManagedRuntime.ManagedRuntime<never, never>;

export function RuntimeProvider<R, E>(
	props: ParentProps<{ runtime: ManagedRuntime.ManagedRuntime<R, E> }>,
) {
	return (
		<RuntimeContext.Provider value={props.runtime as unknown as UntypedManagedRuntime}>
			{props.children}
		</RuntimeContext.Provider>
	);
}

export { useRuntime };
