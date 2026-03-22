import { type AppCommand, EventBus } from "@ctrl/core.ports.event-bus";
import {
	DIAG_PING,
	EVT_DIAG_PONG,
	EVT_NAVIGATED,
	EVT_SESSION_ACTIVATED,
	EVT_SESSION_CLOSED,
	EVT_SESSION_CREATED,
	NAV_BACK,
	NAV_FORWARD,
	NAV_NAVIGATE,
	SESSION_ACTIVATE,
	SESSION_CLOSE,
	SESSION_CREATE,
} from "@ctrl/core.shared";
import { OmniboxFeature } from "@ctrl/domain.feature.omnibox";
import { SessionFeature } from "@ctrl/domain.feature.session";
import { Effect, Runtime, Stream } from "effect";

type Services = {
	bus: EventBus["Type"];
	sessions: SessionFeature["Type"];
	omnibox: OmniboxFeature["Type"];
};

function handleSessionCreate({ bus, sessions }: Services) {
	return Effect.gen(function* () {
		const session = yield* sessions.create("visual");
		yield* sessions.setActive(session.id);
		yield* bus.publish({
			type: "event",
			name: EVT_SESSION_CREATED,
			timestamp: Date.now(),
			payload: { id: session.id },
			causedBy: SESSION_CREATE,
		});
	});
}

function handleSessionClose({ bus, sessions }: Services, payload: unknown) {
	const p = payload as { id: string } | undefined;
	if (!p?.id) return Effect.void;
	return Effect.gen(function* () {
		yield* sessions.remove(p.id);
		yield* bus.publish({
			type: "event",
			name: EVT_SESSION_CLOSED,
			timestamp: Date.now(),
			payload: { id: p.id },
			causedBy: SESSION_CLOSE,
		});
	});
}

function handleSessionActivate({ bus, sessions }: Services, payload: unknown) {
	const p = payload as { id: string } | undefined;
	if (!p?.id) return Effect.void;
	return Effect.gen(function* () {
		yield* sessions.setActive(p.id);
		yield* bus.publish({
			type: "event",
			name: EVT_SESSION_ACTIVATED,
			timestamp: Date.now(),
			payload: { id: p.id },
			causedBy: SESSION_ACTIVATE,
		});
	});
}

function handleNavNavigate({ bus, sessions, omnibox }: Services, payload: unknown) {
	const p = payload as { id: string; input: string } | undefined;
	if (!p?.id || !p?.input) return Effect.void;
	return Effect.gen(function* () {
		const { url } = yield* omnibox.resolve(p.input);
		yield* sessions.navigate(p.id, url);
		yield* bus.publish({
			type: "event",
			name: EVT_NAVIGATED,
			timestamp: Date.now(),
			payload: { sessionId: p.id, url },
			causedBy: NAV_NAVIGATE,
		});
	});
}

function handleNavBack({ sessions }: Services, payload: unknown) {
	const p = payload as { sessionId: string } | undefined;
	if (!p?.sessionId) return Effect.void;
	return sessions.goBack(p.sessionId).pipe(Effect.asVoid);
}

function handleNavForward({ sessions }: Services, payload: unknown) {
	const p = payload as { sessionId: string } | undefined;
	if (!p?.sessionId) return Effect.void;
	return sessions.goForward(p.sessionId).pipe(Effect.asVoid);
}

function handleDiagPing({ bus }: Services) {
	return bus.publish({
		type: "event",
		name: EVT_DIAG_PONG,
		timestamp: Date.now(),
		payload: { message: "EventBus alive" },
		causedBy: DIAG_PING,
	});
}

function routeCommand(svc: Services, cmd: AppCommand) {
	switch (cmd.action) {
		case SESSION_CREATE:
			return handleSessionCreate(svc);
		case SESSION_CLOSE:
			return handleSessionClose(svc, cmd.payload);
		case SESSION_ACTIVATE:
			return handleSessionActivate(svc, cmd.payload);
		case NAV_NAVIGATE:
			return handleNavNavigate(svc, cmd.payload);
		case NAV_BACK:
			return handleNavBack(svc, cmd.payload);
		case NAV_FORWARD:
			return handleNavForward(svc, cmd.payload);
		case DIAG_PING:
			return handleDiagPing(svc);
		default:
			return Effect.void;
	}
}

export function startCommandRouter(
	rt: Runtime.Runtime<EventBus | SessionFeature | OmniboxFeature>,
) {
	const program = Effect.gen(function* () {
		const bus = yield* EventBus;
		const sessions = yield* SessionFeature;
		const omnibox = yield* OmniboxFeature;
		const svc: Services = { bus, sessions, omnibox };

		yield* bus.commands.pipe(
			Stream.runForEach((cmd) =>
				routeCommand(svc, cmd).pipe(
					Effect.catchAll((error) => {
						console.error(`[CommandRouter] ${cmd.action}:`, error);
						return Effect.void;
					}),
				),
			),
		);
	});

	Runtime.runFork(rt)(program);
	console.info("[bun] CommandRouter started — listening for EventBus commands");
}
