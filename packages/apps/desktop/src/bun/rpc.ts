import { APP_NAME } from "@ctrl/base.type";
import rootPkg from "../../../../../package.json";

const APP_VERSION = rootPkg.version;

type EffectRpcMessage = unknown;

type GetAppInfoParams = Record<string, never>;
type GetAppInfoResponse = { name: string; version: string };

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

/**
 * Create Electrobun RPC definition.
 * The getAppInfo handler returns static app metadata and needs no runtime.
 */
export function createMainRPC() {
	return BrowserView.defineRPC<MainRPCSchema>({
		handlers: {
			requests: {
				getAppInfo: (_raw: unknown) => Promise.resolve({ name: APP_NAME, version: APP_VERSION }),
			},
			messages: {
				"effect-rpc": () => {},
				"app-commands": () => {},
			},
		},
	});
}
