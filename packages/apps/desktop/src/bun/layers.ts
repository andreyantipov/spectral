import { homedir } from "node:os";
import { join } from "node:path";
import { makeDbClient, TabRepositoryLive } from "@ctrl/domain.adapter.db";
import { TabFeatureLive } from "@ctrl/domain.feature.tab";
import { BrowsingServiceLive } from "@ctrl/domain.service.browsing";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { Layer } from "effect";

const dbPath = join(homedir(), ".ctrl.page", "data.db");

// Infrastructure: libsql client -> Drizzle ORM
const DbClientLive = makeDbClient(`file:${dbPath}`);
const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbClientLive));

// Domain: TabRepository -> TabFeature -> BrowsingService
const TabRepositoryLayer = TabRepositoryLive.pipe(Layer.provide(DrizzleLive));
const TabFeatureLayer = TabFeatureLive.pipe(Layer.provide(TabRepositoryLayer));
const BrowsingServiceLayer = BrowsingServiceLive.pipe(Layer.provide(TabFeatureLayer));

// Compose: expose all layers needed by the app
// - DbClientLive: for migrations (LibsqlClient)
// - TabRepositoryLayer: TabManager still uses TabRepository directly during transition
// - BrowsingServiceLayer: new hex architecture entry point
export const DesktopLive = Layer.mergeAll(DbClientLive, TabRepositoryLayer, BrowsingServiceLayer);

export type AppLayer = Layer.Layer.Success<typeof DesktopLive>;
