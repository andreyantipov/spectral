export const APP_NAME = "ctrl.page";
export const APP_VERSION = "0.0.1";

export { makeFeatureService } from "./api/make-feature-service";
export { DEFAULT_SESSION_MODE, DEFAULT_TAB_TITLE, DEFAULT_TAB_URL } from "./lib/constants";
export { canGoBack, canGoForward, currentPage, currentUrl } from "./lib/session.helpers";
export { spanName } from "./lib/span-name";
export { withTracing } from "./lib/with-tracing";
export { withWebTracing } from "./lib/with-web-tracing";
export * from "./model/actions";
export type { AppCommand, ShowNotification, ToggleCommandCenter } from "./model/commands";
export * from "./model/errors";
export * from "./model/ports";
export * from "./model/schemas";
export * from "./model/shortcuts";
export * from "./rpc-schemas";
