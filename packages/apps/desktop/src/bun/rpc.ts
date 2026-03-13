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
import type { TabManager } from "./tab-manager";

export function createMainRPC(runtime: Runtime.Runtime<AppLayer>, tabManager: TabManager) {
	return BrowserView.defineRPC<MainRPCSchema>({
		handlers: {
			requests: {
				getAppInfo: makeRpcHandler(runtime, GetAppInfoParams, GetAppInfoResponse, () =>
					Effect.succeed({
						name: APP_NAME,
						version: APP_VERSION,
					}),
				),

				getTabs: (_raw: unknown) => tabManager.getSidebarState(),

				createTab: (raw: unknown) => {
					const params = raw as { url: string };
					return tabManager.createTab(params.url);
				},

				closeTab: (raw: unknown) => {
					const params = raw as { id: number };
					return tabManager.closeTab(params.id);
				},

				switchTab: (raw: unknown) => {
					const params = raw as { id: number };
					return tabManager.switchTab(params.id);
				},

				navigateTab: (raw: unknown) => {
					const params = raw as { url: string };
					return tabManager.navigateTab(params.url);
				},

				setSidebarSection: (raw: unknown) => {
					const params = raw as { id: string };
					return tabManager.setSidebarSection(params.id);
				},

				setSidebarCollapsed: (raw: unknown) => {
					const params = raw as { collapsed: boolean };
					return tabManager.setSidebarCollapsed(params.collapsed);
				},

				setSidebarWidth: (raw: unknown) => {
					const params = raw as { width: number };
					return tabManager.setSidebarWidth(params.width);
				},
			},
			messages: {},
		},
	});
}
