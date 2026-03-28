import { type AppCommand, EventBus } from "@ctrl/core.port.event-bus";
import { BookmarkFeature } from "@ctrl/domain.feature.bookmark";
import { HistoryFeature } from "@ctrl/domain.feature.history";
import { OmniboxFeature } from "@ctrl/domain.feature.omnibox";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { Effect, Layer, Stream } from "effect";

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
		name: "state.snapshot",
		payload: { sessions: s, bookmarks: b, history: h },
		timestamp: Date.now(),
	});
}).pipe(Effect.orDie);

// Debounce: max one snapshot per 50ms
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let forkSnapshot: (() => void) | null = null;

const scheduleSnapshot = Effect.sync(() => {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		forkSnapshot?.();
	}, 50);
});

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
			name: "diag.pong",
			timestamp: Date.now(),
			payload: { message: "EventBus alive" },
			causedBy: "diag.ping",
		});
	});

// -- Dispatch table -----------------------------------------------------------

type Services = BookmarkFeature | EventBus | HistoryFeature | OmniboxFeature | SessionFeature;
type HandlerFn = (p: Payload) => Effect.Effect<void, never, Services>;

const MUTATION_ACTIONS = new Set([
	"session.create",
	"session.close",
	"session.activate",
	"nav.navigate",
	"nav.back",
	"nav.forward",
	"nav.report",
	"nav.update-title",
	"bm.add",
	"bm.remove",
]);

const handlers: Record<string, HandlerFn | undefined> = {
	"session.create": () => handleSessionCreate(),
	"session.close": (p) => (p.id ? handleSessionClose(p) : Effect.void),
	"session.activate": (p) => (p.id ? handleSessionActivate(p) : Effect.void),
	"nav.navigate": (p) => (p.id && p.input ? handleNavNavigate(p) : Effect.void),
	"nav.back": (p) => (p.id ? handleNavBack(p) : Effect.void),
	"nav.forward": (p) => (p.id ? handleNavForward(p) : Effect.void),
	"nav.report": (p) => (p.id && p.url ? handleNavReport(p) : Effect.void),
	"nav.update-title": (p) => (p.id && p.title ? handleNavUpdateTitle(p) : Effect.void),
	"bm.add": (p) => (p.url ? handleBmAdd(p) : Effect.void),
	"bm.remove": (p) => (p.id ? handleBmRemove(p) : Effect.void),
	"diag.ping": () => handleDiagPing(),
};

const dispatch = (cmd: AppCommand) => {
	const handler = handlers[cmd.action];
	if (!handler) return Effect.void;
	const effect = handler((cmd.payload as Payload) ?? {});
	if (MUTATION_ACTIONS.has(cmd.action)) {
		return effect.pipe(Effect.tap(() => scheduleSnapshot));
	}
	return effect;
};

/**
 * EventBridgeLive subscribes to EventBus.commands and dispatches each command
 * to the appropriate domain feature handler. After mutations, publishes a
 * debounced state.snapshot event with full browsing state.
 */
export const EventBridgeLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;

		// Capture fork function for debounced snapshot timer callback
		const runtime = yield* Effect.runtime<
			BookmarkFeature | EventBus | HistoryFeature | SessionFeature
		>();
		forkSnapshot = () => {
			import("effect").then(({ Runtime }) => {
				Runtime.runFork(runtime)(publishSnapshot);
			});
		};

		// Listen for commands and dispatch
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

		// Publish initial state snapshot so UI has data on first render
		yield* publishSnapshot;

		console.info("[bun] EventBridge started — listening for EventBus commands");
	}),
);
