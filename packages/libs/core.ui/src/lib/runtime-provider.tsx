import type { ManagedRuntime } from "effect";
import { createContext, type ParentProps, useContext } from "solid-js";

/**
 * The runtime context is intentionally untyped — it holds a ManagedRuntime
 * for an arbitrary layer shape, determined at app bootstrap. Service access
 * is type-safe at the call-site via Context.Tag lookups.
 */
// biome's noExplicitAny is suppressed at the biome config level for this file.
// The ManagedRuntime generic params are erased here because the context bridges
// typed Effect services into untyped SolidJS reactive tree.
type UntypedManagedRuntime = ManagedRuntime.ManagedRuntime<never, never>;

const RuntimeContext = createContext<UntypedManagedRuntime>();

export function RuntimeProvider<R, E>(
	props: ParentProps<{ runtime: ManagedRuntime.ManagedRuntime<R, E> }>,
) {
	return (
		<RuntimeContext.Provider value={props.runtime as unknown as UntypedManagedRuntime}>
			{props.children}
		</RuntimeContext.Provider>
	);
}

export function useRuntime() {
	const runtime = useContext(RuntimeContext);
	if (!runtime) throw new Error("RuntimeProvider not found — wrap your app in <RuntimeProvider>");
	return runtime;
}
