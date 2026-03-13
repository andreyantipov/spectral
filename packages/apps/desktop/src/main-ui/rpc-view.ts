import type { MainRPCSchema } from "@ctrl/core.shared";

export function defineRPC(Electroview: { defineRPC: <_T>(config: unknown) => unknown }) {
	return Electroview.defineRPC<MainRPCSchema>({
		handlers: {
			requests: {},
			messages: {},
		},
	});
}
