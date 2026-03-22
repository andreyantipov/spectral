// Re-export shim — consumers should migrate to direct imports from core.base.*
// This file will be deleted once all consumers are updated.

// core.base.errors
export { DatabaseError, ValidationError } from "@ctrl/core.base.errors";

// core.base.tracing
export { spanName, withTracing, withWebTracing } from "@ctrl/core.base.tracing";
// core.base.types
export {
	APP_NAME,
	APP_VERSION,
	canGoBack,
	canGoForward,
	currentPage,
	currentUrl,
	DEFAULT_SESSION_MODE,
	DEFAULT_TAB_TITLE,
	DEFAULT_TAB_URL,
} from "@ctrl/core.base.types";
export type { ShortcutBinding } from "@ctrl/core.port.event-bus";
// core.port.event-bus shortcuts
// core.port.event-bus signals (for consumers migrating gradually)
export {
	AgentSignals,
	BookmarkSignals,
	DEFAULT_SHORTCUTS,
	DiagnosticSignals,
	HistorySignals,
	NavigationSignals,
	SessionSignals,
	UISignals,
	WorkspaceSignals,
} from "@ctrl/core.port.event-bus";

// --- Local exports that haven't moved yet ---

// Ports (will move to core.port.storage in Phase 2)
export { makeFeatureService } from "./api/make-feature-service";
// Action string constants (consumers should migrate to Signal definitions)
export * from "./model/actions";
export type { AppCommand, ShowNotification, ToggleCommandCenter } from "./model/commands";
export * from "./model/ports";
// Schemas (consumers should migrate to @ctrl/core.base.model)
export * from "./model/schemas";

// RPC schemas (will move in Phase 2)
export * from "./rpc-schemas";
