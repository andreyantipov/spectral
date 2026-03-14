import type { Electroview } from "electrobun/view";

export function defineRPC(ev: typeof Electroview) {
	return ev.defineRPC({
		handlers: {
			requests: {},
			messages: {},
		},
	});
}
