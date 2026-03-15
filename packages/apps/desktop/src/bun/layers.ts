import { homedir } from "node:os";
import { join } from "node:path";
import { makeDbClient, SessionRepositoryLive } from "@ctrl/domain.adapter.db";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import { BrowsingHandlersLive } from "@ctrl/domain.service.browsing";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { Layer } from "effect";

const dbPath = join(homedir(), ".ctrl.page", "data.db");

// Infrastructure: libsql client -> Drizzle ORM
const DbClientLive = makeDbClient(`file:${dbPath}`);
const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbClientLive));

// Domain: SessionRepository -> SessionFeature -> BrowsingHandlers
const SessionRepositoryLayer = SessionRepositoryLive.pipe(Layer.provide(DrizzleLive));
const SessionFeatureLayer = SessionFeatureLive.pipe(Layer.provide(SessionRepositoryLayer));
const BrowsingHandlersLayer = BrowsingHandlersLive.pipe(Layer.provide(SessionFeatureLayer));

// Compose: expose all layers needed by the app
// - DbClientLive: for migrations (LibsqlClient)
// - BrowsingHandlersLayer: Effect RPC handler implementations
export const DesktopLive = Layer.mergeAll(DbClientLive, BrowsingHandlersLayer);

export type AppLayer = Layer.Layer.Success<typeof DesktopLive>;
