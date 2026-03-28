import { homedir } from "node:os";
import { join } from "node:path";
import { makeDbClient } from "@ctrl/domain.adapter.db";
import { OTEL_SERVICE_NAMES, OtelLive } from "@ctrl/domain.adapter.otel";
import { BunLive } from "@ctrl/domain.runtime.bun";
import { Layer } from "effect";

const dbPath = join(homedir(), ".spectral", "data.db");
const DbClientLive = makeDbClient(`file:${dbPath}`);
const OtelLayer = OtelLive(OTEL_SERVICE_NAMES.main);

export const DesktopLive = Layer.mergeAll(
	DbClientLive,
	BunLive.pipe(Layer.provide(DbClientLive), Layer.provide(OtelLayer)),
);

export type AppLayer = Layer.Layer.Success<typeof DesktopLive>;
