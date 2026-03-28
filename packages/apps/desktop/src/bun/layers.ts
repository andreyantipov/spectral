import { homedir } from "node:os";
import { join } from "node:path";
import { EventBusHandlersLive, EventBusLive } from "@ctrl/core.port.event-bus";
import {
	BookmarkRepositoryLive,
	HistoryRepositoryLive,
	LayoutRepositoryLive,
	makeDbClient,
	SessionRepositoryLive,
} from "@ctrl/domain.adapter.db";
import { OTEL_SERVICE_NAMES, OtelLive } from "@ctrl/domain.adapter.otel";
import { BookmarkFeatureLive } from "@ctrl/domain.feature.bookmark";
import { HistoryFeatureLive } from "@ctrl/domain.feature.history";
import { LayoutFeatureLive } from "@ctrl/domain.feature.layout";
import { OmniboxFeatureLive } from "@ctrl/domain.feature.omnibox";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import { WorkspaceHandlersLive } from "@ctrl/domain.service.workspace";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { Layer } from "effect";
import { EventBridgeLive } from "./event-bridge";

const dbPath = join(homedir(), ".spectral", "data.db");

// Infrastructure: libsql client -> Drizzle ORM
const DbClientLive = makeDbClient(`file:${dbPath}`);
const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbClientLive));

// Domain: Repositories -> Features -> Handlers
const SessionRepositoryLayer = SessionRepositoryLive.pipe(Layer.provide(DrizzleLive));
const BookmarkRepositoryLayer = BookmarkRepositoryLive.pipe(Layer.provide(DrizzleLive));
const HistoryRepositoryLayer = HistoryRepositoryLive.pipe(Layer.provide(DrizzleLive));
const LayoutRepositoryLayer = LayoutRepositoryLive.pipe(Layer.provide(DrizzleLive));

const SessionFeatureLayer = SessionFeatureLive.pipe(Layer.provide(SessionRepositoryLayer));
const BookmarkFeatureLayer = BookmarkFeatureLive.pipe(Layer.provide(BookmarkRepositoryLayer));
const HistoryFeatureLayer = HistoryFeatureLive.pipe(Layer.provide(HistoryRepositoryLayer));
const LayoutFeatureLayer = LayoutFeatureLive.pipe(Layer.provide(LayoutRepositoryLayer));

const WorkspaceHandlersLayer = WorkspaceHandlersLive.pipe(Layer.provide(LayoutFeatureLayer));

// OTEL: must be provided to handlers so Effect.withSpan() picks up the tracer
const OtelLayer = OtelLive(OTEL_SERVICE_NAMES.main);

const TracedWorkspaceLayer = WorkspaceHandlersLayer.pipe(Layer.provide(OtelLayer));

// EventBus: handlers need the EventBus service from EventBusLive
const EventBusHandlersLayer = EventBusHandlersLive.pipe(Layer.provide(EventBusLive));

// EventBridge: routes EventBus commands to domain feature handlers.
// Replaces the old imperative startCommandRouter() — runs as a scoped Layer.
const EventBridgeLayer = EventBridgeLive.pipe(
	Layer.provide(SessionFeatureLayer),
	Layer.provide(BookmarkFeatureLayer),
	Layer.provide(HistoryFeatureLayer),
	Layer.provide(OmniboxFeatureLive),
	Layer.provide(EventBusLive),
	Layer.provide(OtelLayer),
);

// Compose: expose all layers needed by the app
// - DbClientLive: for migrations (LibsqlClient)
// - TracedWorkspaceLayer: workspace RPC handlers with OTEL tracing
// - EventBusLive: EventBus service
// - EventBusHandlersLayer: EventBus RPC handlers
// - EventBridgeLayer: EventBus command → feature handler dispatch
export const DesktopLive = Layer.mergeAll(
	DbClientLive,
	TracedWorkspaceLayer,
	EventBusLive,
	EventBusHandlersLayer,
	EventBridgeLayer,
);

export type AppLayer = Layer.Layer.Success<typeof DesktopLive>;
