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

// Tab types (aligned with domain Tab type: string id, boolean isActive, nullable title)
export const TabInfo = Schema.Struct({
	id: Schema.String,
	url: Schema.String,
	title: Schema.NullOr(Schema.String),
	position: Schema.Number,
	isActive: Schema.Boolean,
});
export type TabInfo = typeof TabInfo.Type;

export const TabState = Schema.Struct({
	tabs: Schema.Array(TabInfo),
	activeTabId: Schema.NullOr(Schema.String),
});
export type TabState = typeof TabState.Type;

// Sidebar state
export const SidebarState = Schema.Struct({
	activeSection: Schema.String,
	collapsed: Schema.Boolean,
	tabs: Schema.Array(TabInfo),
	activeTabId: Schema.NullOr(Schema.String),
});
export type SidebarState = typeof SidebarState.Type;

// Sidebar requests
export const SetSidebarSectionParams = Schema.Struct({
	id: Schema.String,
});
export type SetSidebarSectionParams = typeof SetSidebarSectionParams.Type;

export const SetSidebarCollapsedParams = Schema.Struct({
	collapsed: Schema.Boolean,
});
export type SetSidebarCollapsedParams = typeof SetSidebarCollapsedParams.Type;

export const SetSidebarWidthParams = Schema.Struct({
	width: Schema.Number,
});
export type SetSidebarWidthParams = typeof SetSidebarWidthParams.Type;

// Tab requests
export const GetTabsParams = Schema.Struct({});
export type GetTabsParams = typeof GetTabsParams.Type;

export const CreateTabParams = Schema.Struct({
	url: Schema.String,
});
export type CreateTabParams = typeof CreateTabParams.Type;

export const CloseTabParams = Schema.Struct({
	id: Schema.String,
});
export type CloseTabParams = typeof CloseTabParams.Type;

export const SwitchTabParams = Schema.Struct({
	id: Schema.String,
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
				response: SidebarState;
			};
			createTab: {
				params: CreateTabParams;
				response: SidebarState;
			};
			closeTab: {
				params: CloseTabParams;
				response: SidebarState;
			};
			switchTab: {
				params: SwitchTabParams;
				response: SidebarState;
			};
			navigateTab: {
				params: NavigateTabParams;
				response: SidebarState;
			};
			setSidebarSection: {
				params: SetSidebarSectionParams;
				response: SidebarState;
			};
			setSidebarCollapsed: {
				params: SetSidebarCollapsedParams;
				response: SidebarState;
			};
			setSidebarWidth: {
				params: SetSidebarWidthParams;
				response: SidebarState;
			};
		};
		messages: Record<string, never>;
	};
	webview: {
		requests: Record<string, never>;
		messages: {
			navigate: NavigateMessage;
			sidebarStateChanged: SidebarState;
		};
	};
};
