import { Schema } from "effect";

// App Info
export const GetAppInfoParams = Schema.Struct({});
export type GetAppInfoParams = typeof GetAppInfoParams.Type;

export const GetAppInfoResponse = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
});
export type GetAppInfoResponse = typeof GetAppInfoResponse.Type;

export const NavigateMessage = Schema.Struct({
  url: Schema.String,
});
export type NavigateMessage = typeof NavigateMessage.Type;

// Tab types
export const TabInfo = Schema.Struct({
  id: Schema.Number,
  url: Schema.String,
  title: Schema.String,
  position: Schema.Number,
  isActive: Schema.Number,
});
export type TabInfo = typeof TabInfo.Type;

export const TabState = Schema.Struct({
  tabs: Schema.Array(TabInfo),
  activeTabId: Schema.NullOr(Schema.Number),
});
export type TabState = typeof TabState.Type;

// Tab requests
export const GetTabsParams = Schema.Struct({});
export type GetTabsParams = typeof GetTabsParams.Type;

export const CreateTabParams = Schema.Struct({
  url: Schema.String,
});
export type CreateTabParams = typeof CreateTabParams.Type;

export const CloseTabParams = Schema.Struct({
  id: Schema.Number,
});
export type CloseTabParams = typeof CloseTabParams.Type;

export const SwitchTabParams = Schema.Struct({
  id: Schema.Number,
});
export type SwitchTabParams = typeof SwitchTabParams.Type;

export const NavigateTabParams = Schema.Struct({
  url: Schema.String,
});
export type NavigateTabParams = typeof NavigateTabParams.Type;

export type MainRPCSchema = {
  bun: {
    requests: {
      getAppInfo: {
        params: GetAppInfoParams;
        response: GetAppInfoResponse;
      };
      getTabs: {
        params: GetTabsParams;
        response: TabState;
      };
      createTab: {
        params: CreateTabParams;
        response: TabState;
      };
      closeTab: {
        params: CloseTabParams;
        response: TabState;
      };
      switchTab: {
        params: SwitchTabParams;
        response: TabState;
      };
      navigateTab: {
        params: NavigateTabParams;
        response: TabState;
      };
    };
    messages: {};
  };
  webview: {
    requests: {};
    messages: {
      navigate: NavigateMessage;
      tabsChanged: TabState;
    };
  };
};
