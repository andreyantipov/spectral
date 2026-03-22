// Session commands
export const SESSION_CREATE = "session.create" as const;
export const SESSION_CLOSE = "session.close" as const;
export const SESSION_ACTIVATE = "session.activate" as const;

// Navigation commands
export const NAV_NAVIGATE = "nav.navigate" as const;
export const NAV_BACK = "nav.back" as const;
export const NAV_FORWARD = "nav.forward" as const;
export const NAV_REPORT = "nav.report" as const;
export const NAV_UPDATE_TITLE = "nav.update-title" as const;

// Workspace commands
export const WS_SPLIT_RIGHT = "ws.split-right" as const;
export const WS_SPLIT_DOWN = "ws.split-down" as const;
export const WS_CLOSE_PANE = "ws.close-pane" as const;
export const WS_FOCUS_PANE = "ws.focus-pane" as const;

// Bookmark commands
export const BM_ADD = "bm.add" as const;
export const BM_REMOVE = "bm.remove" as const;

// History commands
export const HIST_CLEAR = "hist.clear" as const;

// Agent commands
export const AGENT_CREATE_HEADLESS = "agent.create-headless" as const;
export const AGENT_EVALUATE_JS = "agent.evaluate-js" as const;
export const AGENT_CLOSE_HEADLESS = "agent.close-headless" as const;

// UI commands
export const UI_TOGGLE_OMNIBOX = "ui.toggle-omnibox" as const;
export const UI_TOGGLE_SIDEBAR = "ui.toggle-sidebar" as const;

// --- Event names ---
export const EVT_SESSION_CREATED = "session.created" as const;
export const EVT_SESSION_CLOSED = "session.closed" as const;
export const EVT_SESSION_ACTIVATED = "session.activated" as const;
export const EVT_NAVIGATED = "nav.navigated" as const;
export const EVT_TITLE_UPDATED = "nav.title-updated" as const;
export const EVT_LAYOUT_CHANGED = "ws.layout-changed" as const;
export const EVT_PANE_SPLIT = "ws.pane-split" as const;
export const EVT_BOOKMARK_ADDED = "bm.added" as const;
export const EVT_BOOKMARK_REMOVED = "bm.removed" as const;
export const EVT_HISTORY_CLEARED = "hist.cleared" as const;
export const EVT_SYS_DOM_READY = "sys.dom-ready" as const;
export const EVT_SYS_DID_NAVIGATE = "sys.did-navigate" as const;
