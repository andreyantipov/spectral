// Electrobun doesn't export clean types for static Electroview methods.
// Type the parameter structurally based on the actual API surface we use.
type EmptyHandlers = Record<string, never>;

export function defineRPC<T>(ev: {
	defineRPC: (config: { handlers: { requests: EmptyHandlers; messages: EmptyHandlers } }) => T;
}): T {
	return ev.defineRPC({
		handlers: {
			requests: {} as EmptyHandlers,
			messages: {} as EmptyHandlers,
		},
	});
}
