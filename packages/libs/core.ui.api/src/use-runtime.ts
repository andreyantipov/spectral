import type { ManagedRuntime } from "effect";
import { createContext, useContext } from "solid-js";

/**
 * Shared runtime context — created here so both core.ui.api hooks and
 * core.ui's RuntimeProvider operate on the same SolidJS context instance.
 */
type UntypedManagedRuntime = ManagedRuntime.ManagedRuntime<never, never>;

export const RuntimeContext = createContext<UntypedManagedRuntime>();

export function useRuntime() {
	const runtime = useContext(RuntimeContext);
	if (!runtime) throw new Error("RuntimeProvider not found — wrap your app in <RuntimeProvider>");
	return runtime;
}
