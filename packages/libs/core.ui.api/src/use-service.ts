import type { Context, ManagedRuntime } from "effect";
import { useRuntime } from "./use-runtime";

export function useService<I, S>(tag: Context.Tag<I, S>): S {
	const runtime = useRuntime();
	return (runtime as unknown as ManagedRuntime.ManagedRuntime<I, never>).runSync(tag);
}
