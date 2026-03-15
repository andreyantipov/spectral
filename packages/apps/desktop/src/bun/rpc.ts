import {
	APP_NAME,
	APP_VERSION,
	GetAppInfoParams,
	GetAppInfoResponse,
	type MainRPCSchema,
} from "@ctrl/core.shared";
import { Effect, type Runtime } from "effect";
import { BrowserView } from "electrobun/bun";
import type { AppLayer } from "./layers";
import { makeRpcHandler } from "./rpc-handler";

export function createMainRPC(runtime: Runtime.Runtime<AppLayer>) {
	return BrowserView.defineRPC<MainRPCSchema>({
		handlers: {
			requests: {
				getAppInfo: makeRpcHandler(runtime, GetAppInfoParams, GetAppInfoResponse, () =>
					Effect.succeed({
						name: APP_NAME,
						version: APP_VERSION,
					}),
				),
			},
			messages: {
				"effect-rpc": () => {},
			},
		},
	});
}
