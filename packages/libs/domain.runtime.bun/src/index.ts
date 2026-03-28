import { EventBusHandlersLive, EventBusLive } from "@ctrl/core.port.event-bus";
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
import { BrowsingServiceLive } from "@ctrl/domain.service.browsing";
import { WorkspaceHandlersLive } from "@ctrl/domain.service.workspace";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { Layer } from "effect";

// -- Storage: Drizzle ORM + repositories --------------------------------------
// Requires: SqlClient (provided by app via makeDbClient)

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

// -- Services -----------------------------------------------------------------
// WorkspaceHandlersLive needs LayoutFeature (+ Tracer from app-provided OTEL)

const WorkspaceHandlersLayer = WorkspaceHandlersLive.pipe(Layer.provide(LayoutFeatureLayer));

// -- EventBus -----------------------------------------------------------------

const EventBusHandlersLayer = EventBusHandlersLive.pipe(Layer.provide(EventBusLive));

// -- EventBridge: routes EventBus commands to domain feature handlers ---------
// Re-exports BrowsingServiceLive — listens to EventBus commands, dispatches
// to features, publishes state snapshots after mutations.

const EventBridgeLive = BrowsingServiceLive.pipe(
	Layer.provide(SessionFeatureLayer),
	Layer.provide(BookmarkFeatureLayer),
	Layer.provide(HistoryFeatureLayer),
	Layer.provide(OmniboxFeatureLive),
	Layer.provide(EventBusLive),
);

// -- Compose ------------------------------------------------------------------
// Requires from app: SqlClient (LibsqlClient) + Tracer (OTEL)
// Provides: all domain services, EventBus, EventBridge

export const BunLive = Layer.mergeAll(
	WorkspaceHandlersLayer,
	EventBusLive,
	EventBusHandlersLayer,
	EventBridgeLive,
);
