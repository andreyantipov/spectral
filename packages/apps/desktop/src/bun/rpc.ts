import { APP_NAME } from "@ctrl/core.base.types";
import rootPkg from "../../../../../package.json";

const APP_VERSION = rootPkg.version;

import { Effect, type Runtime, Schema } from "effect";

const GetAppInfoParams = Schema.Struct({});
type GetAppInfoParams = typeof GetAppInfoParams.Type;

const GetAppInfoResponse = Schema.Struct({
	name: Schema.String,
	version: Schema.String,
});
type GetAppInfoResponse = typeof GetAppInfoResponse.Type;

const EffectRpcMessage = Schema.Unknown;
type EffectRpcMessage = typeof EffectRpcMessage.Type;

type MainRPCSchema = {
	bun: {
		requests: {
			getAppInfo: {
				params: GetAppInfoParams;
				response: GetAppInfoResponse;
			};
		};
		messages: {
			"effect-rpc": EffectRpcMessage;
			"app-commands": EffectRpcMessage;
		};
	};
	webview: {
		requests: Record<string, never>;
		messages: {
			"effect-rpc": EffectRpcMessage;
			"app-commands": EffectRpcMessage;
		};
	};
};

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
				"app-commands": () => {},
			},
		},
	});
}
