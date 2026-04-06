import { EventLog } from "@effect/experimental";
import { BookmarkEvents } from "./bookmark";
import { NavigationEvents } from "./navigation";
import { SessionEvents } from "./session";
import { SettingsEvents } from "./settings";
import { SystemEvents } from "./system";
import { TerminalEvents } from "./terminal";
import { UIEvents } from "./ui";
import { WorkspaceEvents } from "./workspace";

/** EventLog schema — only events with handlers in wire.desktop.main.
 * Session/Navigation/Bookmark are handled by SpecRunner (FSM), not EventLog. */
export const AppEvents = EventLog.schema(
	WorkspaceEvents,
	UIEvents,
	SystemEvents,
	SettingsEvents,
	TerminalEvents,
);
