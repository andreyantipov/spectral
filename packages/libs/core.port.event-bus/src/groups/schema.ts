import { EventLog } from "@effect/experimental";
import { BookmarkEvents } from "./bookmark";
import { NavigationEvents } from "./navigation";
import { SessionEvents } from "./session";
import { WorkspaceEvents } from "./workspace";

export const AppEvents = EventLog.schema(
	SessionEvents,
	NavigationEvents,
	BookmarkEvents,
	WorkspaceEvents,
);
