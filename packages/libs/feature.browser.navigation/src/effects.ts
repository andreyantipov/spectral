import { Effect } from "effect";

// Effect keys matching WebSession spec (PascalCase)
const StartNavigation = "StartNavigation";
const UrlIsValid = "UrlIsValid";

export const navigationEffects = Effect.succeed({
	[StartNavigation]: (_p: Record<string, unknown>) => Effect.void,

	[UrlIsValid]: (p: Record<string, unknown>) =>
		Effect.succeed(
			typeof p.url === "string" &&
				(p.url.startsWith("http://") || p.url.startsWith("https://") || p.url === "about:blank"),
		),
});
