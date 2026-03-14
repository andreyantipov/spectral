import { Schema } from "effect";

// App Info
export const GetAppInfoParams = Schema.Struct({});
export type GetAppInfoParams = typeof GetAppInfoParams.Type;

export const GetAppInfoResponse = Schema.Struct({
	name: Schema.String,
	version: Schema.String,
});
export type GetAppInfoResponse = typeof GetAppInfoResponse.Type;

// Effect RPC tunnel message — opaque payload passed through Electrobun IPC
export const EffectRpcMessage = Schema.Unknown;
export type EffectRpcMessage = typeof EffectRpcMessage.Type;

export type MainRPCSchema = {
	bun: {
		requests: {
			getAppInfo: {
				params: GetAppInfoParams;
				response: GetAppInfoResponse;
			};
		};
		messages: {
			"effect-rpc": EffectRpcMessage;
		};
	};
	webview: {
		requests: Record<string, never>;
		messages: {
			"effect-rpc": EffectRpcMessage;
		};
	};
};
