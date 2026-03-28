import { AppEvents, EventBusHandlersLive, EventBusLive } from "@ctrl/core.port.event-bus";
import {
	BookmarkRepositoryLive,
	HistoryRepositoryLive,
	LayoutRepositoryLive,
	SessionRepositoryLive,
} from "@ctrl/domain.adapter.db";
import { BookmarkFeatureLive } from "@ctrl/domain.feature.bookmark";
import { HistoryFeatureLive } from "@ctrl/domain.feature.history";
import { LayoutFeatureLive } from "@ctrl/domain.feature.layout";
import { OmniboxFeatureLive } from "@ctrl/domain.feature.omnibox";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import {
	BookmarkHandlers,
	BrowsingServiceLive,
	NavigationHandlers,
	SessionHandlers,
	WorkspaceHandlers,
} from "@ctrl/domain.service.browsing";
import { WorkspaceHandlersLive } from "@ctrl/domain.service.workspace";
import { EventJournal, EventLog } from "@effect/experimental";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { Effect, Layer } from "effect";

// -- Storage: Drizzle ORM + repositories --------------------------------------

const DrizzleLive = drizzleLayer;

const SessionRepositoryLayer = SessionRepositoryLive.pipe(Layer.provide(DrizzleLive));
const BookmarkRepositoryLayer = BookmarkRepositoryLive.pipe(Layer.provide(DrizzleLive));
const HistoryRepositoryLayer = HistoryRepositoryLive.pipe(Layer.provide(DrizzleLive));
const LayoutRepositoryLayer = LayoutRepositoryLive.pipe(Layer.provide(DrizzleLive));

// -- Features -----------------------------------------------------------------

const SessionFeatureLayer = SessionFeatureLive.pipe(Layer.provide(SessionRepositoryLayer));
const BookmarkFeatureLayer = BookmarkFeatureLive.pipe(Layer.provide(BookmarkRepositoryLayer));
const HistoryFeatureLayer = HistoryFeatureLive.pipe(Layer.provide(HistoryRepositoryLayer));
const LayoutFeatureLayer = LayoutFeatureLive.pipe(Layer.provide(LayoutRepositoryLayer));

// -- EventLog: typed handlers + in-memory journal -----------------------------

const IdentityLive = Layer.effect(
	EventLog.Identity,
	Effect.sync(() => EventLog.Identity.makeRandom()),
);
const JournalLive = EventJournal.layerMemory;

const HandlersLive = Layer.mergeAll(
	SessionHandlers.pipe(Layer.provide(SessionFeatureLayer)),
	NavigationHandlers.pipe(
		Layer.provide(SessionFeatureLayer),
		Layer.provide(OmniboxFeatureLive),
		Layer.provide(HistoryFeatureLayer),
	),
	BookmarkHandlers.pipe(Layer.provide(BookmarkFeatureLayer)),
	WorkspaceHandlers.pipe(Layer.provide(LayoutFeatureLayer)),
);

const EventLogLive = EventLog.layer(AppEvents).pipe(
	Layer.provide(HandlersLive),
	Layer.provide(JournalLive),
	Layer.provide(IdentityLive),
);

// -- Services -----------------------------------------------------------------

const WorkspaceHandlersLayer = WorkspaceHandlersLive.pipe(Layer.provide(LayoutFeatureLayer));

const EventBusHandlersLayer = EventBusHandlersLive.pipe(Layer.provide(EventBusLive));

const BrowsingServiceLayer = BrowsingServiceLive.pipe(
	Layer.provide(EventLogLive),
	Layer.provide(SessionFeatureLayer),
	Layer.provide(BookmarkFeatureLayer),
	Layer.provide(HistoryFeatureLayer),
	Layer.provide(LayoutFeatureLayer),
	Layer.provide(OmniboxFeatureLive),
	Layer.provide(EventBusLive),
);

// -- Compose ------------------------------------------------------------------
// Requires from app: SqlClient (LibsqlClient) + Tracer (OTEL)

export const BunLive = Layer.mergeAll(
	WorkspaceHandlersLayer,
	EventBusLive,
	EventBusHandlersLayer,
	BrowsingServiceLayer,
);
