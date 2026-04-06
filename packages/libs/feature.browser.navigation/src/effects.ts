import { Effects } from "@ctrl/base.op.browsing";
import { Effect } from "effect";

export const navigationEffects = Effect.succeed({
	[Effects.NAV_START]: (_p: Record<string, unknown>) => Effect.void,

	[Effects.NAV_CANCEL]: (_p: Record<string, unknown>) => Effect.void,

	[Effects.URL_IS_VALID]: (p: Record<string, unknown>) =>
		Effect.succeed(
			typeof p.url === "string" &&
				(p.url.startsWith("http://") || p.url.startsWith("https://") || p.url === "about:blank"),
		),
});
