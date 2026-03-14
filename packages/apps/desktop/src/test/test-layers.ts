import { type Page, type Session, SessionRepository } from "@ctrl/core.shared";
import { type TestSpanExporter, TestSpanExporterLive } from "@ctrl/domain.adapter.otel";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import { BrowsingHandlersLive, BrowsingRpcs } from "@ctrl/domain.service.browsing";
import { Effect, Layer } from "effect";

let nextId = 0;
let sessions: Session[] = [];

const makeSession = (mode: "visual"): Session => {
	const id = String(++nextId);
	return {
		id,
		pages: [],
		currentIndex: -1,
		mode,
		isActive: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
};

export const MockSessionRepositoryLive = Layer.succeed(SessionRepository, {
	getAll: () => Effect.succeed(sessions),
	getById: (id: string) => Effect.succeed(sessions.find((s) => s.id === id)),
	create: (mode: "visual") =>
		Effect.sync(() => {
			const session = makeSession(mode);
			sessions = [...sessions, session];
			return session;
		}),
	remove: (id: string) =>
		Effect.sync(() => {
			sessions = sessions.filter((s) => s.id !== id);
		}),
	setActive: (_id: string) => Effect.void,
	updateCurrentIndex: (_id: string, _index: number) => Effect.void,
	addPage: (_sessionId: string, url: string, _atIndex: number) =>
		Effect.succeed({
			url,
			title: null,
			loadedAt: new Date().toISOString(),
		} satisfies Page),
	removePagesAfterIndex: (_sessionId: string, _index: number) => Effect.void,
	updatePageTitle: (_sessionId: string, _pageIndex: number, _title: string) => Effect.void,
});

export const resetMockSessions = () => {
	sessions = [];
	nextId = 0;
};

export const PipelineTestLayer = BrowsingHandlersLive.pipe(
	Layer.provide(SessionFeatureLive),
	Layer.provide(MockSessionRepositoryLive),
	Layer.provideMerge(TestSpanExporterLive),
) as Layer.Layer<BrowsingRpcs | TestSpanExporter>;
