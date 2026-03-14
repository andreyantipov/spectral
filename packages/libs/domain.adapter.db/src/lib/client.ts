import { LibsqlClient } from "@effect/sql-libsql";
import type { Layer } from "effect";

export const makeDbClient = (url: string): Layer.Layer<LibsqlClient.LibsqlClient> =>
	LibsqlClient.layer({ url }) as Layer.Layer<LibsqlClient.LibsqlClient>;
