import { type AppCommand, EventBus } from "@ctrl/core.port.event-bus";
import {
	BM_ADD,
	BM_REMOVE,
	DIAG_PING,
	EVT_DIAG_PONG,
	NAV_BACK,
	NAV_FORWARD,
	NAV_NAVIGATE,
	NAV_REPORT,
	NAV_UPDATE_TITLE,
	SESSION_ACTIVATE,
	SESSION_CLOSE,
	SESSION_CREATE,
} from "@ctrl/core.shared";
import { BookmarkFeature } from "@ctrl/domain.feature.bookmark";
import { HistoryFeature } from "@ctrl/domain.feature.history";
import { OmniboxFeature } from "@ctrl/domain.feature.omnibox";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { Effect, Layer, Stream } from "effect";

type Payload = Record<string, unknown>;

// -- Session handlers (mirrors SessionHandlers from browsing.eventlog) --------

const handleSessionCreate = () =>
	Effect.gen(function* () {
		const sessions = yield* SessionFeature;
		const session = yield* sessions.create("visual");
		yield* sessions.setActive(session.id);
	}).pipe(Effect.orDie);

const handleSessionClose = (p: Payload) =>
	Effect.gen(function* () {
		const sessions = yield* SessionFeature;
		yield* sessions.remove(p.id as string);
	}).pipe(Effect.orDie);

const handleSessionActivate = (p: Payload) =>
	Effect.gen(function* () {
		const sessions = yield* SessionFeature;
		yield* sessions.setActive(p.id as string);
	}).pipe(Effect.orDie);

// -- Navigation handlers (mirrors NavigationHandlers from browsing.eventlog) --

const handleNavNavigate = (p: Payload) =>
	Effect.gen(function* () {
		const sessions = yield* SessionFeature;
		const omnibox = yield* OmniboxFeature;
		const history = yield* HistoryFeature;
		const { url, query } = yield* omnibox.resolve(p.input as string);
		yield* sessions.navigate(p.id as string, url);
		yield* history.record(url, null, query).pipe(Effect.ignore);
	}).pipe(Effect.orDie);

const handleNavBack = (p: Payload) =>
	Effect.gen(function* () {
		const sessions = yield* SessionFeature;
		yield* sessions.goBack(p.id as string);
	}).pipe(Effect.orDie);

const handleNavForward = (p: Payload) =>
	Effect.gen(function* () {
		const sessions = yield* SessionFeature;
		yield* sessions.goForward(p.id as string);
	}).pipe(Effect.orDie);

const handleNavReport = (p: Payload) =>
	Effect.gen(function* () {
		const sessions = yield* SessionFeature;
		const history = yield* HistoryFeature;
		yield* sessions.updateUrl(p.id as string, p.url as string);
		yield* history.record(p.url as string, null, null).pipe(Effect.ignore);
	}).pipe(Effect.orDie);

const handleNavUpdateTitle = (p: Payload) =>
	Effect.gen(function* () {
		const sessions = yield* SessionFeature;
		yield* sessions.updateTitle(p.id as string, p.title as string);
	}).pipe(Effect.orDie);

// -- Bookmark handlers (mirrors BookmarkHandlers from browsing.eventlog) ------

const handleBmAdd = (p: Payload) =>
	Effect.gen(function* () {
		const bookmarks = yield* BookmarkFeature;
		yield* bookmarks.create(p.url as string, (p.title as string | null) ?? null);
	}).pipe(Effect.orDie);

const handleBmRemove = (p: Payload) =>
	Effect.gen(function* () {
		const bookmarks = yield* BookmarkFeature;
		yield* bookmarks.remove(p.id as string);
	}).pipe(Effect.orDie);

// -- Diagnostic (kept for agentic validation) ---------------------------------

const handleDiagPing = () =>
	Effect.gen(function* () {
		const bus = yield* EventBus;
		yield* bus.publish({
			type: "event",
			name: EVT_DIAG_PONG,
			timestamp: Date.now(),
			payload: { message: "EventBus alive" },
			causedBy: DIAG_PING,
		});
	});

// -- Dispatch table -----------------------------------------------------------

type Services = SessionFeature | BookmarkFeature | HistoryFeature | OmniboxFeature | EventBus;
type HandlerFn = (p: Payload) => Effect.Effect<void, never, Services>;

const handlers: Record<string, HandlerFn | undefined> = {
	[SESSION_CREATE]: () => handleSessionCreate(),
	[SESSION_CLOSE]: (p) => (p.id ? handleSessionClose(p) : Effect.void),
	[SESSION_ACTIVATE]: (p) => (p.id ? handleSessionActivate(p) : Effect.void),
	[NAV_NAVIGATE]: (p) => (p.id && p.input ? handleNavNavigate(p) : Effect.void),
	[NAV_BACK]: (p) => (p.id ? handleNavBack(p) : Effect.void),
	[NAV_FORWARD]: (p) => (p.id ? handleNavForward(p) : Effect.void),
	[NAV_REPORT]: (p) => (p.id && p.url ? handleNavReport(p) : Effect.void),
	[NAV_UPDATE_TITLE]: (p) => (p.id && p.title ? handleNavUpdateTitle(p) : Effect.void),
	[BM_ADD]: (p) => (p.url ? handleBmAdd(p) : Effect.void),
	[BM_REMOVE]: (p) => (p.id ? handleBmRemove(p) : Effect.void),
	[DIAG_PING]: () => handleDiagPing(),
};

const dispatch = (cmd: AppCommand) => {
	const handler = handlers[cmd.action];
	if (!handler) return Effect.void;
	return handler((cmd.payload as Payload) ?? {});
};

/**
 * EventBridgeLive subscribes to EventBus.commands and dispatches each command
 * to the appropriate domain feature handler. This replaces the old imperative
 * startCommandRouter() — it runs as a Layer so it starts automatically with the
 * runtime and is torn down with it.
 *
 * The handler logic mirrors the EventLog handlers in browsing.eventlog.ts.
 * When EventJournal persistence is added, this bridge will be replaced by full
 * EventLog.write() dispatch.
 */
export const EventBridgeLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;

		yield* bus.commands.pipe(
			Stream.runForEach((cmd) =>
				dispatch(cmd).pipe(
					Effect.catchAll((error) => {
						console.error(`[EventBridge] ${cmd.action}:`, error);
						return Effect.void;
					}),
				),
			),
			Effect.forkScoped,
		);

		console.info("[bun] EventBridge started — listening for EventBus commands");
	}),
);
