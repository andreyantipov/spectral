import {
	type AppCommand,
	BM_ADD,
	BM_REMOVE,
	type BrowsingState,
	DIAG_PING,
	DIAG_PONG,
	EventBus,
	MUTATION_TAGS,
	NAV_BACK,
	NAV_FORWARD,
	NAV_NAVIGATE,
	NAV_REPORT,
	NAV_UPDATE_TITLE,
	SESSION_ACTIVATE,
	SESSION_CLOSE,
	SESSION_CREATE,
	STATE_SNAPSHOT,
} from "@ctrl/core.port.event-bus";
import { BookmarkFeature } from "@ctrl/domain.feature.bookmark";
import { HistoryFeature } from "@ctrl/domain.feature.history";
import { OmniboxFeature } from "@ctrl/domain.feature.omnibox";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { Effect, Layer, Stream } from "effect";
import { BROWSING_SERVICE } from "../lib/constants";

type Payload = Record<string, unknown>;

// -- Snapshot publishing ------------------------------------------------------

const publishSnapshot = Effect.gen(function* () {
	const bus = yield* EventBus;
	const sessions = yield* SessionFeature;
	const bookmarks = yield* BookmarkFeature;
	const history = yield* HistoryFeature;
	const [s, b, h] = yield* Effect.all([sessions.getAll(), bookmarks.getAll(), history.getAll()]);
	yield* bus.publish({
		type: "event",
		name: STATE_SNAPSHOT,
		payload: { sessions: s, bookmarks: b, history: h } satisfies BrowsingState,
		timestamp: Date.now(),
	});
}).pipe(Effect.orDie);

// -- Command handlers ---------------------------------------------------------

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

const handleDiagPing = () =>
	Effect.gen(function* () {
		const bus = yield* EventBus;
		yield* bus.publish({
			type: "event",
			name: DIAG_PONG,
			timestamp: Date.now(),
			payload: { message: "EventBus alive" },
			causedBy: DIAG_PING,
		});
	});

// -- Dispatch table -----------------------------------------------------------

type Services = BookmarkFeature | EventBus | HistoryFeature | OmniboxFeature | SessionFeature;
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
	const effect = handler((cmd.payload as Payload) ?? {});
	if (MUTATION_TAGS.has(cmd.action)) {
		return effect.pipe(Effect.andThen(publishSnapshot));
	}
	return effect;
};

/**
 * BrowsingServiceLive listens to EventBus commands and dispatches to domain
 * features. After mutations, publishes state.snapshot events with full
 * browsing state (sessions + bookmarks + history).
 */
export const BrowsingServiceLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;

		// Listen for commands and dispatch
		yield* bus.commands.pipe(
			Stream.runForEach((cmd) =>
				dispatch(cmd).pipe(
					Effect.catchAll((error) => {
						console.error(`[${BROWSING_SERVICE}] ${cmd.action}:`, error);
						return Effect.void;
					}),
				),
			),
			Effect.forkScoped,
		);

		// Publish initial state snapshot
		yield* publishSnapshot;

		console.info(`[bun] ${BROWSING_SERVICE} started`);
	}),
);
