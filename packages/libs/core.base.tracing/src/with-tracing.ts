import { Effect } from "effect";
import { spanName } from "./span-name";

export const withTracing = <S extends Record<string, unknown>>(
	serviceName: string,
	service: S,
): S =>
	Object.fromEntries(
		Object.entries(service).map(([method, fn]) => {
			if (typeof fn === "function") {
				return [
					method,
					(...args: never[]) => {
						const result = (fn as (...a: never[]) => unknown)(...args);
						if (Effect.isEffect(result)) {
							return result.pipe(Effect.withSpan(spanName(serviceName, method)));
						}
						return result;
					},
				];
			}
			return [method, fn];
		}),
	) as S;
