import { Layer } from "effect";
import { DatabaseServiceLive, TabServiceLive } from "@ctrl/core.db";
import { join } from "node:path";
import { homedir } from "node:os";

const dbPath = join(homedir(), ".ctrl.page", "data.db");

const DatabaseLive = DatabaseServiceLive({
  url: `file:${dbPath}`,
});

const TabsLive = Layer.provide(TabServiceLive, DatabaseLive);

export const DesktopLive = Layer.merge(DatabaseLive, TabsLive);

export type AppLayer = Layer.Layer.Success<typeof DesktopLive>;
