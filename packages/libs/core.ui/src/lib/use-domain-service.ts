import type { Context, Stream } from "effect";
import { useService } from "./use-service";
import { useStream } from "./use-stream";

type StreamValue<S> = S extends Stream.Stream<infer A, unknown, never> ? A : never;

type DomainServiceShape = { changes: Stream.Stream<unknown, unknown, never> };

export function useDomainService<I, A extends DomainServiceShape>(tag: Context.Tag<I, A>) {
	const service = useService(tag);
	type V = StreamValue<A["changes"]>;
	const data = useStream<V | undefined>(
		service.changes as Stream.Stream<V | undefined, unknown, never>,
		undefined,
	);
	return { data, actions: service };
}
