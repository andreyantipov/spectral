import { BrowserView } from "electrobun/bun";
import { Effect, Runtime } from "effect";
import {
  APP_NAME,
  APP_VERSION,
  type MainRPCSchema,
  GetAppInfoParams,
  GetAppInfoResponse,
  GetTabsParams,
  TabState,
  CreateTabParams,
  CloseTabParams,
  SwitchTabParams,
  NavigateTabParams,
} from "@ctrl/core.shared";
import type { AppLayer } from "./layers";
import { makeRpcHandler } from "./rpc-handler";
import type { TabManager } from "./tab-manager";

export function createMainRPC(
  runtime: Runtime.Runtime<AppLayer>,
  tabManager: TabManager,
) {
  return BrowserView.defineRPC<MainRPCSchema>({
    handlers: {
      requests: {
        getAppInfo: makeRpcHandler(
          runtime,
          GetAppInfoParams,
          GetAppInfoResponse,
          () =>
            Effect.succeed({
              name: APP_NAME,
              version: APP_VERSION,
            }),
        ),

        getTabs: (_raw: unknown) =>
          tabManager.getTabState(),

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
      },
      messages: {},
    },
  });
}
