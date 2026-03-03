import { Effect, Runtime, Schema } from "effect";
import type { AppLayer } from "./layers";

export function makeRpcHandler<P, PA, R, RA>(
  runtime: Runtime.Runtime<AppLayer>,
  paramsSchema: Schema.Schema<P, PA>,
  responseSchema: Schema.Schema<R, RA>,
  handler: (params: P) => Effect.Effect<R, unknown, AppLayer>,
) {
  return (raw: unknown) =>
    Runtime.runPromise(runtime)(
      Effect.gen(function* () {
        const params = yield* Schema.decodeUnknown(paramsSchema)(raw);
        const result = yield* handler(params);
        return yield* Schema.encode(responseSchema)(result);
      }),
    );
}
