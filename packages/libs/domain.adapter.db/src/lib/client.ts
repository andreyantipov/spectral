import type { SqlClient } from "@effect/sql/SqlClient";
import { LibsqlClient } from "@effect/sql-libsql";
import type { Layer } from "effect";

export const makeDbClient = (url: string): Layer.Layer<LibsqlClient.LibsqlClient | SqlClient> =>
	LibsqlClient.layer({ url });
