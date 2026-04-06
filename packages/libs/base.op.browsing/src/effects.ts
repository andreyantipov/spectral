export const Effects = {
	NAV_START: "nav.start",
	NAV_CANCEL: "nav.cancel",
	SESSION_CREATE: "session.create",
	SESSION_CLOSE: "session.close",
	SESSION_ACTIVATE: "session.activate",
	SESSION_UPDATE_URL: "session.updateUrl",
	SESSION_UPDATE_TITLE: "session.updateTitle",
	SESSION_UPDATE_FAVICON: "session.updateFavicon",
	SESSION_SET_ERROR: "session.setError",
	HISTORY_RECORD: "history.record",
	URL_IS_VALID: "url.isValid",
} as const;
