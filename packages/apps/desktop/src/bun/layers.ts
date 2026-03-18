import { homedir } from "node:os";
import { join } from "node:path";
import {
	BookmarkRepositoryLive,
	HistoryRepositoryLive,
	makeDbClient,
	SessionRepositoryLive,
} from "@ctrl/domain.adapter.db";
import { BookmarkFeatureLive } from "@ctrl/domain.feature.bookmark";
import { HistoryFeatureLive } from "@ctrl/domain.feature.history";
import { OmniboxFeatureLive } from "@ctrl/domain.feature.omnibox";
import { SessionFeatureLive } from "@ctrl/domain.feature.session";
import { BrowsingHandlersLive } from "@ctrl/domain.service.browsing";
import { layer as drizzleLayer } from "@effect/sql-drizzle/Sqlite";
import { Layer } from "effect";

const dbPath = join(homedir(), ".ctrl.page", "data.db");

// Infrastructure: libsql client -> Drizzle ORM
const DbClientLive = makeDbClient(`file:${dbPath}`);
const DrizzleLive = drizzleLayer.pipe(Layer.provide(DbClientLive));

// Domain: Repositories -> Features -> BrowsingHandlers
const SessionRepositoryLayer = SessionRepositoryLive.pipe(Layer.provide(DrizzleLive));
const BookmarkRepositoryLayer = BookmarkRepositoryLive.pipe(Layer.provide(DrizzleLive));
const HistoryRepositoryLayer = HistoryRepositoryLive.pipe(Layer.provide(DrizzleLive));

const SessionFeatureLayer = SessionFeatureLive.pipe(Layer.provide(SessionRepositoryLayer));
const BookmarkFeatureLayer = BookmarkFeatureLive.pipe(Layer.provide(BookmarkRepositoryLayer));
const HistoryFeatureLayer = HistoryFeatureLive.pipe(Layer.provide(HistoryRepositoryLayer));

const BrowsingHandlersLayer = BrowsingHandlersLive.pipe(
	Layer.provide(SessionFeatureLayer),
	Layer.provide(BookmarkFeatureLayer),
	Layer.provide(HistoryFeatureLayer),
	Layer.provide(OmniboxFeatureLive),
);

// Compose: expose all layers needed by the app
// - DbClientLive: for migrations (LibsqlClient)
// - BrowsingHandlersLayer: Effect RPC handler implementations
export const DesktopLive = Layer.mergeAll(DbClientLive, BrowsingHandlersLayer);

export type AppLayer = Layer.Layer.Success<typeof DesktopLive>;
