/**
 * Command tags — single source of truth.
 * Extracted from EventGroup definitions. All consumers import from here.
 */

// Session
export const SESSION_CREATE = "session.create" as const;
export const SESSION_CLOSE = "session.close" as const;
export const SESSION_ACTIVATE = "session.activate" as const;

// Navigation
export const NAV_NAVIGATE = "nav.navigate" as const;
export const NAV_BACK = "nav.back" as const;
export const NAV_FORWARD = "nav.forward" as const;
export const NAV_REPORT = "nav.report" as const;
export const NAV_UPDATE_TITLE = "nav.update-title" as const;

// Bookmarks
export const BM_ADD = "bm.add" as const;
export const BM_REMOVE = "bm.remove" as const;

// Diagnostics
export const DIAG_PING = "diag.ping" as const;

// Events (published by service, subscribed by UI)
export const STATE_SNAPSHOT = "state.snapshot" as const;
export const DIAG_PONG = "diag.pong" as const;

/** All tags that trigger a state.snapshot after handling */
export const MUTATION_TAGS: ReadonlySet<string> = new Set([
	SESSION_CREATE,
	SESSION_CLOSE,
	SESSION_ACTIVATE,
	NAV_NAVIGATE,
	NAV_BACK,
	NAV_FORWARD,
	NAV_REPORT,
	NAV_UPDATE_TITLE,
	BM_ADD,
	BM_REMOVE,
]);
