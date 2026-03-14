import type { Electroview } from "electrobun/view";

// Electroview is imported as a type; typeof Electroview gives the class (constructor) type.
// This lets callers pass the Electroview class itself as a value.
type ElectroviewStatic = typeof Electroview;

export function defineRPC(ev: ElectroviewStatic) {
	return ev.defineRPC({
		handlers: {
			requests: {},
			messages: {},
		},
	});
}
