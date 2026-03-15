// Electrobun doesn't export clean types for static Electroview methods.
// Type the parameter structurally based on the actual API surface we use.
type EmptyHandlers = Record<string, never>;

type MessageHandlers = {
	"effect-rpc": () => void;
	"app-commands": () => void;
};

export function defineRPC<T>(ev: {
	defineRPC: (config: { handlers: { requests: EmptyHandlers; messages: MessageHandlers } }) => T;
}): T {
	return ev.defineRPC({
		handlers: {
			requests: {} as EmptyHandlers,
			messages: {
				"effect-rpc": () => {},
				"app-commands": () => {},
			},
		},
	});
}
